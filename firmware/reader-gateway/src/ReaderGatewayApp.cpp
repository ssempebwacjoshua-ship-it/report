#include "ssamenj/ReaderGatewayApp.h"

#include <ArduinoOTA.h>
#include <LittleFS.h>
#include <WiFi.h>
#include <time.h>

namespace {
constexpr const char* FACTORY_RESET_FLAG_PATH = "/reader-gateway/factory-reset.once";

const char* wifiStatusToString(wl_status_t status) {
  switch (status) {
    case WL_IDLE_STATUS:
      return "IDLE";
    case WL_NO_SSID_AVAIL:
      return "NO_SSID_AVAIL";
    case WL_SCAN_COMPLETED:
      return "SCAN_COMPLETED";
    case WL_CONNECTED:
      return "CONNECTED";
    case WL_CONNECT_FAILED:
      return "CONNECT_FAILED";
    case WL_CONNECTION_LOST:
      return "CONNECTION_LOST";
    case WL_DISCONNECTED:
      return "DISCONNECTED";
    default:
      return "UNKNOWN";
  }
}

GatewayFeedbackTone toneFromBeep(const String& beep) {
  if (beep.equalsIgnoreCase("success")) {
    return GatewayFeedbackTone::Success;
  }
  if (beep.equalsIgnoreCase("warning")) {
    return GatewayFeedbackTone::Error;
  }
  if (beep.equalsIgnoreCase("duplicate")) {
    return GatewayFeedbackTone::Error;
  }
  if (beep.equalsIgnoreCase("error")) {
    return GatewayFeedbackTone::Error;
  }
  if (beep.equalsIgnoreCase("offline") || beep.equalsIgnoreCase("offline_queued")) {
    return GatewayFeedbackTone::NetworkFailure;
  }
  return GatewayFeedbackTone::None;
}

bool isTimeValid() {
  return time(nullptr) > 1700000000;
}

bool isTerminalApiResponse(const ReaderApiResponse& response) {
  return response.statusCode >= 200 && response.statusCode < 500 &&
         response.statusCode != 408 && response.statusCode != 429;
}

constexpr unsigned long HEARTBEAT_INTERVAL_MS = 60000;
constexpr unsigned long MAX_RETRY_INTERVAL_MS = 5UL * 60UL * 1000UL;

bool isZeroValue(const String& value) {
  return value.length() > 0 && value.equals("0");
}
}  // namespace

bool ReaderGatewayApp::consumeFactoryResetFlag() {
  if (!LittleFS.exists(FACTORY_RESET_FLAG_PATH)) {
    return false;
  }

  Serial.println("Factory reset flag detected");
  const bool queueCleared = offlineQueue_.clear();
  wiegand_.reset();
  lastQueueAttemptMs_ = 0;
  lastHeartbeatMs_ = 0;
  lastSuccessfulApiContactAt_ = "";
  const bool flagRemoved = LittleFS.remove(FACTORY_RESET_FLAG_PATH);
  Serial.printf("Factory reset queue cleared: %s\n", queueCleared ? "yes" : "no");
  Serial.printf("Factory reset flag removed: %s\n", flagRemoved ? "yes" : "no");
  return true;
}

bool ReaderGatewayApp::isValidScanEvent(const ReaderScanEvent& event, const char*& reason) const {
  reason = nullptr;

  if (event.rawWiegandBitCount == 0) {
    reason = "no pulses received";
    return false;
  }
  if (event.rawWiegandBitCount != 26 && event.rawWiegandBitCount != 34 && event.rawWiegandBitCount != 37) {
    reason = "unsupported bit count";
    return false;
  }
  if (event.rawWiegandBinary.indexOf('1') < 0) {
    reason = "all-zero bit frame";
    return false;
  }
  if (isZeroValue(event.rawWiegandDecimal)) {
    reason = "raw wiegand decimal is zero";
    return false;
  }
  if (isZeroValue(event.credential)) {
    reason = "credential is zero";
    return false;
  }
  if (isZeroValue(event.cardNumber)) {
    reason = "card number is zero";
    return false;
  }
  if (isZeroValue(event.facilityCode) && isZeroValue(event.cardNumber)) {
    reason = "facility code and card number are both zero";
    return false;
  }
  return true;
}

unsigned long ReaderGatewayApp::retryDelayFor(const ReaderScanEvent& event) const {
  uint8_t exponent = static_cast<uint8_t>(event.retryCount > 5 ? 5 : event.retryCount);
  unsigned long delayMs = config_.retryIntervalMs;
  while (exponent > 0 && delayMs < MAX_RETRY_INTERVAL_MS) {
    if (delayMs > MAX_RETRY_INTERVAL_MS / 2UL) {
      delayMs = MAX_RETRY_INTERVAL_MS;
      break;
    }
    delayMs *= 2UL;
    exponent -= 1;
  }
  return delayMs > MAX_RETRY_INTERVAL_MS ? MAX_RETRY_INTERVAL_MS : delayMs;
}

bool ReaderGatewayApp::begin() {
  Serial.begin(115200);
  delay(200);
  Serial.println("Reader Ready");

  if (!configManager_.begin()) {
    Serial.println("Config storage init failed");
    return false;
  }
  if (!offlineQueue_.begin()) {
    Serial.println("Offline queue init failed");
    return false;
  }
  consumeFactoryResetFlag();

  config_ = ConfigManager::defaults();
  const bool configLoaded = configManager_.load(config_);
  Serial.println(configLoaded ? "Config load complete" : "Config load failed; using defaults");
  config_.firmwareVersion = SSAMENJ_GATEWAY_VERSION;
  Serial.printf("Loaded readerId: %s\n", config_.readerId.c_str());
  Serial.printf("Loaded schoolId: %s\n", config_.schoolId.c_str());
  Serial.printf("Loaded apiBaseUrl: %s\n", config_.apiBaseUrl.c_str());
  Serial.printf("Wi-Fi SSID configured: %s\n", config_.wifiSsid.c_str());
  Serial.printf("Configured D0 pin: %d\n", static_cast<int>(config_.d0Pin));
  Serial.printf("Configured D1 pin: %d\n", static_cast<int>(config_.d1Pin));

  feedback_.begin(config_);
  gatewayClient_.begin(config_);
  deviceRegistration_.begin(&gatewayClient_, &config_);
  wiegand_.begin(config_.d0Pin, config_.d1Pin, config_.wiegandTimeoutMs);

  ensureWiFi();
  ensureOta();
  if (WiFi.status() == WL_CONNECTED) {
    syncClock();
    if (config_.autoRegister) {
      deviceRegistration_.registerNow();
    }
    processOfflineQueue();
  }

  return true;
}

void ReaderGatewayApp::ensureWiFi() {
  if (config_.wifiSsid.isEmpty()) {
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  const unsigned long now = millis();
  if (now - lastWifiAttemptMs_ < config_.wifiReconnectIntervalMs) {
    return;
  }
  lastWifiAttemptMs_ = now;

  Serial.printf("Wi-Fi state: %s (%d)\n", wifiStatusToString(WiFi.status()), static_cast<int>(WiFi.status()));
  Serial.printf("Connecting to SSID: %s\n", config_.wifiSsid.c_str());
  WiFi.disconnect(true);
  WiFi.begin(config_.wifiSsid.c_str(), config_.wifiPassword.c_str());
}

void ReaderGatewayApp::syncClock() {
  if (config_.ntpServer.isEmpty()) {
    return;
  }

  configTime(0, 0, config_.ntpServer.c_str());
  const unsigned long startedAt = millis();
  while (!isTimeValid() && millis() - startedAt < config_.timeSyncTimeoutMs) {
    delay(100);
  }
  clockSynced_ = isTimeValid();
}

void ReaderGatewayApp::ensureOta() {
  if (otaStarted_ || WiFi.status() != WL_CONNECTED) {
    return;
  }

  ArduinoOTA.setHostname(config_.deviceId.c_str());
  if (!config_.otaPassword.isEmpty()) {
    ArduinoOTA.setPassword(config_.otaPassword.c_str());
  }
  ArduinoOTA.begin();
  otaStarted_ = true;
}

bool ReaderGatewayApp::hasWorkingNetwork() const {
  return WiFi.status() == WL_CONNECTED;
}

String ReaderGatewayApp::utcIso8601Now() const {
  if (!clockSynced_ && !isTimeValid()) {
    return "1970-01-01T00:00:00Z";
  }

  struct tm timeInfo {};
  if (!getLocalTime(&timeInfo, 1000)) {
    return "1970-01-01T00:00:00Z";
  }

  char buffer[25];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &timeInfo);
  return String(buffer);
}

String ReaderGatewayApp::createEventId() const {
  const uint32_t a = esp_random();
  const uint32_t b = esp_random();
  const uint32_t c = esp_random();
  const uint32_t d = esp_random();
  char buffer[37];
  snprintf(
    buffer,
    sizeof(buffer),
    "%08lx-%04lx-%04lx-%04lx-%08lx%04lx",
    static_cast<unsigned long>(a),
    static_cast<unsigned long>(b & 0xFFFF),
    static_cast<unsigned long>((c >> 16) & 0xFFFF),
    static_cast<unsigned long>(c & 0xFFFF),
    static_cast<unsigned long>(d),
    static_cast<unsigned long>(b >> 16)
  );
  return String(buffer);
}

void ReaderGatewayApp::markApiContact() {
  lastSuccessfulApiContactAt_ = utcIso8601Now();
}

void ReaderGatewayApp::sendHeartbeat() {
  if (!hasWorkingNetwork()) {
    return;
  }

  const unsigned long now = millis();
  if (now - lastHeartbeatMs_ < HEARTBEAT_INTERVAL_MS) {
    return;
  }
  lastHeartbeatMs_ = now;

  ReaderHeartbeatMetrics metrics;
  metrics.wifiRssi = WiFi.RSSI();
  metrics.localIp = WiFi.localIP().toString();
  metrics.uptimeMs = now;
  metrics.freeHeap = ESP.getFreeHeap();
  metrics.queueDepth = offlineQueue_.size();
  metrics.lastSuccessfulApiContactAt = lastSuccessfulApiContactAt_;

  ReaderApiResponse response;
  if (gatewayClient_.postHeartbeat(config_, metrics, response) && response.success) {
    markApiContact();
    Serial.println("Heartbeat Success");
    return;
  }

  Serial.println("Heartbeat Failed");
}

void ReaderGatewayApp::processScan(const ReaderScanEvent& scan) {
  ReaderScanEvent event = scan;
  const char* invalidReason = nullptr;
  if (!isValidScanEvent(event, invalidReason)) {
    Serial.printf("Dropped scan before queue/upload: %s\n", invalidReason == nullptr ? "invalid event" : invalidReason);
    feedback_.play(GatewayFeedbackTone::Error);
    return;
  }

  event.eventId = createEventId();
  event.deviceTime = utcIso8601Now();
  event.readerId = config_.readerId;
  event.schoolId = config_.schoolId;
  event.deviceId = config_.deviceId;
  event.firmwareVersion = config_.firmwareVersion;
  event.retryCount = 0;
  event.syncStatus = "pending";

  Serial.println("Card Read");
  Serial.printf("Wiegand bit count: %u\n", static_cast<unsigned int>(event.rawWiegandBitCount));
  Serial.printf("Wiegand raw binary: %s\n", event.rawWiegandBinary.c_str());
  Serial.printf("Wiegand raw decimal: %s\n", event.rawWiegandDecimal.c_str());
  Serial.printf("Wiegand raw hex: %s\n", event.rawWiegandHex.c_str());
  Serial.printf("Wiegand credential decimal: %s\n", event.credential.c_str());
  if (!event.facilityCode.isEmpty()) {
    Serial.printf("Wiegand facility code: %s\n", event.facilityCode.c_str());
  }
  if (!event.cardNumber.isEmpty()) {
    Serial.printf("Wiegand card number: %s\n", event.cardNumber.c_str());
  }

  if (hasWorkingNetwork()) {
    ReaderApiResponse response;
    gatewayClient_.postScan(config_, event, response);
    if (isTerminalApiResponse(response)) {
      markApiContact();
      Serial.println(response.success ? "Upload Success" : "Scan Rejected");
      feedback_.play(toneFromBeep(response.beep));
      return;
    }

    Serial.println("Upload Failed");
    Serial.printf("Queue status before offline enqueue: %u\n", static_cast<unsigned int>(offlineQueue_.size()));
  }

  if (offlineQueue_.enqueue(event)) {
    Serial.println("Queued Offline");
    Serial.printf("Queue status after enqueue: %u\n", static_cast<unsigned int>(offlineQueue_.size()));
    feedback_.play(GatewayFeedbackTone::NetworkFailure);
    return;
  }
  feedback_.play(GatewayFeedbackTone::Error);
}

void ReaderGatewayApp::processOfflineQueue() {
  if (!hasWorkingNetwork()) {
    return;
  }

  ReaderScanEvent event;
  while (offlineQueue_.peek(event)) {
    const char* invalidReason = nullptr;
    if (!isValidScanEvent(event, invalidReason)) {
      Serial.printf("Dropped queued event: %s\n", invalidReason == nullptr ? "invalid event" : invalidReason);
      offlineQueue_.pop();
      Serial.printf("Queue status after drop: %u\n", static_cast<unsigned int>(offlineQueue_.size()));
      yield();
      continue;
    }

    const unsigned long retryDelayMs = retryDelayFor(event);
    if (event.retryCount > 0 && millis() - lastQueueAttemptMs_ < retryDelayMs) {
      return;
    }
    lastQueueAttemptMs_ = millis();

    ReaderApiResponse response;
    gatewayClient_.postScan(config_, event, response);
    if (!isTerminalApiResponse(response)) {
      event.retryCount += 1;
      event.syncStatus = "pending";
      offlineQueue_.updateFront(event);
      Serial.printf("Upload Failed; retryCount=%lu nextRetryMs=%lu\n", static_cast<unsigned long>(event.retryCount), retryDelayFor(event));
      Serial.printf("Queue status pending retry: %u\n", static_cast<unsigned int>(offlineQueue_.size()));
      break;
    }

    offlineQueue_.pop();
    lastQueueAttemptMs_ = 0;
    markApiContact();
    Serial.printf("Queue status after dequeue: %u\n", static_cast<unsigned int>(offlineQueue_.size()));
    if (response.success) {
      Serial.println("Upload Success");
    } else {
      Serial.printf("Dropped queued event after permanent API response: status=%d action=%s message=%s\n",
        response.statusCode,
        response.action.c_str(),
        response.message.c_str());
    }
    feedback_.play(toneFromBeep(response.beep));
    yield();
  }
}

void ReaderGatewayApp::loop() {
  feedback_.loop();
  ArduinoOTA.handle();
  ensureWiFi();

  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiConnectedLogged_) {
      Serial.println("Wi-Fi Connected");
      Serial.printf("Wi-Fi state: %s (%d)\n", wifiStatusToString(WiFi.status()), static_cast<int>(WiFi.status()));
      Serial.printf("Wi-Fi IP: %s\n", WiFi.localIP().toString().c_str());
      Serial.printf("Wi-Fi RSSI: %d dBm\n", WiFi.RSSI());
      wifiConnectedLogged_ = true;
      syncClock();
      ensureOta();
      if (config_.autoRegister) {
        deviceRegistration_.registerNow();
      }
    }
    processOfflineQueue();
    sendHeartbeat();
  } else {
    if (wifiConnectedLogged_) {
      Serial.printf("Wi-Fi state: %s (%d)\n", wifiStatusToString(WiFi.status()), static_cast<int>(WiFi.status()));
    }
    wifiConnectedLogged_ = false;
  }

  if (WiFi.status() == WL_CONNECTED && deviceRegistration_.shouldRegister(millis())) {
    deviceRegistration_.registerNow();
  }

  ReaderScanEvent event;
  if (wiegand_.poll(event)) {
    processScan(event);
  }
}
