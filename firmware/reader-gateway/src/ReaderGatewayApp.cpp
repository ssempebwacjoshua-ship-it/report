#include "ssamenj/ReaderGatewayApp.h"

#include <ArduinoOTA.h>
#include <LittleFS.h>
#include <WiFi.h>
#include <time.h>

namespace {
GatewayFeedbackTone toneFromBeep(const String& beep) {
  if (beep.equalsIgnoreCase("success")) {
    return GatewayFeedbackTone::Success;
  }
  if (beep.equalsIgnoreCase("warning")) {
    return GatewayFeedbackTone::Warning;
  }
  if (beep.equalsIgnoreCase("error")) {
    return GatewayFeedbackTone::Error;
  }
  return GatewayFeedbackTone::None;
}

bool isTimeValid() {
  return time(nullptr) > 1'700'000'000;
}
}  // namespace

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

  config_ = ConfigManager::defaults();
  configManager_.load(config_);
  config_.firmwareVersion = SSAMENJ_GATEWAY_VERSION;

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

void ReaderGatewayApp::processScan(const ReaderScanEvent& scan) {
  ReaderScanEvent event = scan;
  event.eventId = createEventId();
  event.deviceTime = utcIso8601Now();
  event.readerId = config_.readerId;
  event.schoolId = config_.schoolId;
  event.deviceId = config_.deviceId;
  event.firmwareVersion = config_.firmwareVersion;
  event.retryCount = 0;
  event.syncStatus = "pending";

  Serial.println("Card Read");

  if (hasWorkingNetwork()) {
    ReaderApiResponse response;
    const bool uploaded = gatewayClient_.postScan(config_, event, response) && response.success;
    if (uploaded) {
      Serial.println("Upload Success");
      feedback_.play(toneFromBeep(response.beep));
      return;
    }

    Serial.println("Upload Failed");
  }

  if (offlineQueue_.enqueue(event)) {
    Serial.println("Queued Offline");
  }
  feedback_.play(hasWorkingNetwork() ? GatewayFeedbackTone::Error : GatewayFeedbackTone::Warning);
}

void ReaderGatewayApp::processOfflineQueue() {
  if (!hasWorkingNetwork()) {
    return;
  }

  if (millis() - lastQueueAttemptMs_ < config_.retryIntervalMs) {
    return;
  }
  lastQueueAttemptMs_ = millis();

  ReaderScanEvent event;
  while (offlineQueue_.peek(event)) {
    ReaderApiResponse response;
    const bool uploaded = gatewayClient_.postScan(config_, event, response) && response.success;
    if (!uploaded) {
      event.retryCount += 1;
      event.syncStatus = "pending";
      offlineQueue_.updateFront(event);
      Serial.println("Upload Failed");
      break;
    }

    offlineQueue_.pop();
    Serial.println("Upload Success");
    feedback_.play(toneFromBeep(response.beep));
  }
}

void ReaderGatewayApp::loop() {
  ArduinoOTA.handle();
  ensureWiFi();

  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiConnectedLogged_) {
      Serial.println("Wi-Fi Connected");
      wifiConnectedLogged_ = true;
      syncClock();
      ensureOta();
      if (config_.autoRegister) {
        deviceRegistration_.registerNow();
      }
    }
    processOfflineQueue();
  } else {
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
