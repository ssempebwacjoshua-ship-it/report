#include "ssamenj/ReaderGatewayApp.h"

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <LittleFS.h>
#include <Preferences.h>
#include <Ticker.h>
#include <Update.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <esp_ota_ops.h>
#include <mbedtls/base64.h>
#include <mbedtls/pk.h>
#include <mbedtls/sha256.h>
#include <memory>
#include <time.h>

#include "ssamenj/BeepToneMapping.h"

namespace {
constexpr const char* FACTORY_RESET_FLAG_PATH = "/reader-gateway/factory-reset.once";
constexpr const char* PENDING_OTA_STATE_PATH = "/reader-gateway/ota-pending.json";
constexpr const char* PROVISIONING_NAMESPACE = "rg-setup";
constexpr const char* PROVISIONING_WIFI_SSID_KEY = "wifiSsid";
constexpr const char* PROVISIONING_WIFI_PASSWORD_KEY = "wifiPass";
constexpr const char* PROVISIONING_ACTIVATION_CODE_KEY = "activationCode";
constexpr const char* PROVISIONING_FIRMWARE_CHANNEL_KEY = "fwChannel";
constexpr const char* PROVISIONING_SETUP_REQUIRED_KEY = "setupReq";
constexpr const char* SETUP_PORTAL_PASSWORD = "ssamenj123";
constexpr unsigned long HEARTBEAT_INTERVAL_MS = 60000;
constexpr unsigned long SETUP_PORTAL_REOPEN_DELAY_MS = 2UL * 60UL * 1000UL;
constexpr unsigned long FACTORY_RESET_HOLD_MS = 10000;
constexpr unsigned long MAX_RETRY_INTERVAL_MS = 5UL * 60UL * 1000UL;
constexpr unsigned long DUPLICATE_SUPPRESSION_WINDOW_MS = 2000;
#ifdef LED_BUILTIN
constexpr int SETUP_LED_PIN = LED_BUILTIN;
#else
constexpr int SETUP_LED_PIN = 2;
#endif
constexpr uint8_t SETUP_LED_ACTIVE_LEVEL = HIGH;
constexpr uint8_t SETUP_LED_IDLE_LEVEL = LOW;
constexpr int FACTORY_RESET_BUTTON_PIN = 0;

String joinPath(const String& base, const String& path) {
  if (base.endsWith("/") && path.startsWith("/")) {
    return base.substring(0, base.length() - 1) + path;
  }
  if (!base.endsWith("/") && !path.startsWith("/")) {
    return base + "/" + path;
  }
  return base + path;
}

String lowerTrimmed(const String& value) {
  String normalized = value;
  normalized.trim();
  normalized.toLowerCase();
  return normalized;
}

bool isLocalApiBaseUrl(const String& value) {
  const String normalized = lowerTrimmed(value);
  return normalized.startsWith("http://localhost")
    || normalized.startsWith("http://127.0.0.1")
    || normalized.startsWith("http://0.0.0.0");
}

String digestToHex(const uint8_t digest[32]) {
  static constexpr char kHex[] = "0123456789abcdef";
  char buffer[65];
  for (size_t index = 0; index < 32; index += 1) {
    buffer[index * 2] = kHex[(digest[index] >> 4) & 0x0F];
    buffer[index * 2 + 1] = kHex[digest[index] & 0x0F];
  }
  buffer[64] = '\0';
  return String(buffer);
}

bool decodeBase64(const String& input, std::unique_ptr<uint8_t[]>& decoded, size_t& decodedLength) {
  decodedLength = 0;
  size_t outputLength = 0;
  const int estimate = (input.length() * 3) / 4 + 4;
  if (estimate <= 0) {
    return false;
  }

  decoded.reset(new uint8_t[static_cast<size_t>(estimate)]);
  const int result = mbedtls_base64_decode(
    decoded.get(),
    static_cast<size_t>(estimate),
    &outputLength,
    reinterpret_cast<const unsigned char*>(input.c_str()),
    input.length()
  );
  if (result != 0) {
    decoded.reset();
    return false;
  }
  decodedLength = outputLength;
  return true;
}

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

GatewayFeedbackTone toneFromResponse(const ReaderApiResponse& response) {
  return feedbackToneFromResponse(
    response.beep.c_str(),
    response.status.c_str(),
    response.statusCode,
    response.success
  );
}

const char* toneName(GatewayFeedbackTone tone) {
  return feedbackToneName(tone);
}

bool isTimeValid() {
  return time(nullptr) > 1700000000;
}

String resetReasonToString(esp_reset_reason_t reason) {
  switch (reason) {
    case ESP_RST_POWERON:
      return "POWER_ON";
    case ESP_RST_EXT:
      return "EXTERNAL";
    case ESP_RST_SW:
      return "SOFTWARE";
    case ESP_RST_PANIC:
      return "PANIC";
    case ESP_RST_INT_WDT:
      return "INT_WDT";
    case ESP_RST_TASK_WDT:
      return "TASK_WDT";
    case ESP_RST_WDT:
      return "WDT";
    case ESP_RST_DEEPSLEEP:
      return "DEEPSLEEP";
    case ESP_RST_BROWNOUT:
      return "BROWNOUT";
    case ESP_RST_SDIO:
      return "SDIO";
    default:
      return "UNKNOWN";
  }
}

bool isTerminalApiResponse(const ReaderApiResponse& response) {
  return response.statusCode >= 200 && response.statusCode < 500 &&
         response.statusCode != 408 && response.statusCode != 429;
}

bool isZeroValue(const String& value) {
  return value.isEmpty() || value.equals("0");
}

void logTlsError(WiFiClientSecure& client) {
  char errorBuffer[128] = {0};
  const int errorCode = client.lastError(errorBuffer, sizeof(errorBuffer));
  if (errorCode != 0 || errorBuffer[0] != '\0') {
    Serial.printf("TLS error code: %d\n", errorCode);
    if (errorBuffer[0] != '\0') {
      Serial.printf("TLS error detail: %s\n", errorBuffer);
    }
  }
}
}  // namespace

bool ReaderGatewayApp::loadPendingOtaManifest(ReaderOtaManifest& manifest) const {
  manifest = ReaderOtaManifest{};
  if (!LittleFS.exists(PENDING_OTA_STATE_PATH)) {
    return false;
  }

  File file = LittleFS.open(PENDING_OTA_STATE_PATH, FILE_READ);
  if (!file) {
    return false;
  }

  JsonDocument doc;
  const DeserializationError error = deserializeJson(doc, file);
  file.close();
  if (error) {
    return false;
  }

  manifest.releaseId = doc["releaseId"] | "";
  manifest.version = doc["version"] | "";
  manifest.channel = doc["channel"] | "";
  manifest.publicKeyId = doc["publicKeyId"] | "";
  return !manifest.releaseId.isEmpty() && !manifest.version.isEmpty();
}

bool ReaderGatewayApp::savePendingOtaManifest(const ReaderOtaManifest& manifest) const {
  JsonDocument doc;
  doc["releaseId"] = manifest.releaseId;
  doc["version"] = manifest.version;
  doc["channel"] = manifest.channel;
  doc["publicKeyId"] = manifest.publicKeyId;

  File file = LittleFS.open(PENDING_OTA_STATE_PATH, FILE_WRITE);
  if (!file) {
    return false;
  }
  const bool ok = serializeJson(doc, file) > 0;
  file.close();
  return ok;
}

void ReaderGatewayApp::clearPendingOtaManifest() const {
  if (LittleFS.exists(PENDING_OTA_STATE_PATH)) {
    LittleFS.remove(PENDING_OTA_STATE_PATH);
  }
}

bool ReaderGatewayApp::beginProvisioningStorage() {
  if (provisioningStorageReady_) {
    return true;
  }
  provisioningStorageReady_ = provisioningPreferences_.begin(PROVISIONING_NAMESPACE, false);
  if (!provisioningStorageReady_) {
    Serial.println("Provisioning storage init failed");
  }
  return provisioningStorageReady_;
}

void ReaderGatewayApp::loadProvisioningState() {
  provisionedWifiSsid_ = "";
  provisionedWifiPassword_ = "";
  provisionedActivationCode_ = "";
  provisionedFirmwareChannel_ = "";
  setupRequired_ = false;

  if (!beginProvisioningStorage()) {
    return;
  }

  provisionedWifiSsid_ = provisioningPreferences_.getString(PROVISIONING_WIFI_SSID_KEY, "");
  provisionedWifiPassword_ = provisioningPreferences_.getString(PROVISIONING_WIFI_PASSWORD_KEY, "");
  provisionedActivationCode_ = provisioningPreferences_.getString(PROVISIONING_ACTIVATION_CODE_KEY, "");
  provisionedFirmwareChannel_ = provisioningPreferences_.getString(PROVISIONING_FIRMWARE_CHANNEL_KEY, "");
  setupRequired_ = provisioningPreferences_.getBool(PROVISIONING_SETUP_REQUIRED_KEY, false);
  provisionedWifiSsid_.trim();
  provisionedWifiPassword_.trim();
  provisionedActivationCode_.trim();
  provisionedFirmwareChannel_.trim();
}

void ReaderGatewayApp::applyProvisioningOverrides() {
  config_.firmwareVersion = SSAMENJ_GATEWAY_VERSION;

  const String wifiSsid = configuredWifiSsid();
  const String wifiPassword = configuredWifiPassword();
  if (!wifiSsid.isEmpty()) {
    config_.wifiSsid = wifiSsid;
    config_.wifiPassword = wifiPassword;
  }

  if (!provisionedActivationCode_.isEmpty()) {
    config_.activationCode = provisionedActivationCode_;
  }
  if (!provisionedFirmwareChannel_.isEmpty()) {
    config_.firmwareChannel = provisionedFirmwareChannel_;
  }
}

bool ReaderGatewayApp::normalizeRegistrationMode() {
  const bool hasAssignedToken = !config_.bearerToken.isEmpty()
    && config_.bearerToken != SSAMENJ_GATEWAY_DEFAULT_PROVISIONING_TOKEN;
  const bool hasActivationCode = !config_.activationCode.isEmpty() || !provisionedActivationCode_.isEmpty();
  const bool shouldUseActivation = !hasAssignedToken && hasActivationCode;
  const String desiredPath = shouldUseActivation ? "/api/readers/activate" : "/api/readers/register";

  if (config_.registrationPath == desiredPath) {
    return false;
  }

  config_.registrationPath = desiredPath;
  Serial.printf("Normalized registration path to %s\n", config_.registrationPath.c_str());
  return persistAssignedConfiguration();
}

bool ReaderGatewayApp::persistAssignedConfiguration() {
  return configManager_.save(config_);
}

void ReaderGatewayApp::applyRegistrationResult(const ReaderRegistrationResult& result) {
  if (!result.schoolId.isEmpty()) {
    config_.schoolId = result.schoolId;
  }
  if (!result.deviceId.isEmpty()) {
    config_.deviceId = result.deviceId;
  }
  if (!result.readerId.isEmpty()) {
    config_.readerId = result.readerId;
  }
  if (!result.bearerToken.isEmpty()) {
    config_.bearerToken = result.bearerToken;
    config_.activationCode = "";
    provisionedActivationCode_ = "";
    config_.registrationPath = "/api/readers/register";
    if (beginProvisioningStorage()) {
      provisioningPreferences_.remove(PROVISIONING_ACTIVATION_CODE_KEY);
    }
  }
  if (!result.apiBaseUrl.isEmpty()) {
    config_.apiBaseUrl = result.apiBaseUrl;
  }
  if (!result.firmwareChannel.isEmpty()) {
    config_.firmwareChannel = result.firmwareChannel;
  }
  if (!result.deviceName.isEmpty()) {
    config_.deviceName = result.deviceName;
  }
  if (!result.readerLocation.isEmpty()) {
    config_.readerLocation = result.readerLocation;
  }
  if (!result.readerType.isEmpty()) {
    config_.readerType = result.readerType;
  }
  if (!result.assignmentStatus.isEmpty()) {
    Serial.printf("Reader assigned to %s\n", result.schoolName.c_str());
    Serial.println("Setup complete");
  }
  persistAssignedConfiguration();
}

bool ReaderGatewayApp::hasStoredWifiCredentials() const {
  if (setupRequired_) {
    return false;
  }
  return !configuredWifiSsid().isEmpty();
}

String ReaderGatewayApp::configuredWifiSsid() const {
  return !provisionedWifiSsid_.isEmpty() ? provisionedWifiSsid_ : config_.wifiSsid;
}

String ReaderGatewayApp::configuredWifiPassword() const {
  if (!provisionedWifiSsid_.isEmpty()) {
    return provisionedWifiPassword_;
  }
  return config_.wifiPassword;
}

String ReaderGatewayApp::setupAccessPointSsid() const {
  const uint64_t chipId = ESP.getEfuseMac();
  char buffer[24];
  snprintf(buffer, sizeof(buffer), "SSAMENJ-Setup-%04llX", static_cast<unsigned long long>(chipId & 0xFFFFULL));
  return String(buffer);
}

void ReaderGatewayApp::toggleSetupLed() {
  setupLedState_ = !setupLedState_;
  digitalWrite(SETUP_LED_PIN, setupLedState_ ? SETUP_LED_ACTIVE_LEVEL : SETUP_LED_IDLE_LEVEL);
}

void ReaderGatewayApp::toggleSetupLedTick(ReaderGatewayApp* app) {
  if (app != nullptr) {
    app->toggleSetupLed();
  }
}

void ReaderGatewayApp::startSetupLedBlink() {
  pinMode(SETUP_LED_PIN, OUTPUT);
  setupLedState_ = false;
  digitalWrite(SETUP_LED_PIN, SETUP_LED_IDLE_LEVEL);
  setupLedTicker_.detach();
  setupLedTicker_.attach_ms(500, &ReaderGatewayApp::toggleSetupLedTick, this);
}

void ReaderGatewayApp::stopSetupLedBlink() {
  setupLedTicker_.detach();
  setupLedState_ = false;
  pinMode(SETUP_LED_PIN, OUTPUT);
  digitalWrite(SETUP_LED_PIN, SETUP_LED_IDLE_LEVEL);
}

bool ReaderGatewayApp::openSetupPortal(const char* reason) {
  if (!beginProvisioningStorage()) {
    return false;
  }

  WiFi.mode(WIFI_AP_STA);
  WiFi.setAutoReconnect(true);

  WiFiManager manager;
  const bool preconfiguredDeployment = !config_.schoolId.isEmpty() && !config_.bearerToken.isEmpty() && config_.registrationPath.endsWith("/register");
  String activationCodeValue = provisionedActivationCode_.isEmpty() ? config_.activationCode : provisionedActivationCode_;
  char activationCodeBuffer[65];
  activationCodeValue.toCharArray(activationCodeBuffer, sizeof(activationCodeBuffer));
  WiFiManagerParameter activationCodeParam("activationCode", "Activation Code", activationCodeBuffer, sizeof(activationCodeBuffer));

  manager.setTitle("SSAMENJ Attendance Controller");
  manager.setCaptivePortalEnable(true);
  manager.setConnectTimeout(30);
  if (!preconfiguredDeployment) {
    manager.addParameter(&activationCodeParam);
  }

  const String apSsid = setupAccessPointSsid();
  Serial.printf("Opening setup portal: %s\n", reason == nullptr ? "manual" : reason);
  Serial.printf("Setup portal SSID: %s\n", apSsid.c_str());
  Serial.println("Setup portal fallback URL: http://192.168.4.1");

  startSetupLedBlink();
  const bool connected = manager.startConfigPortal(apSsid.c_str(), SETUP_PORTAL_PASSWORD);
  stopSetupLedBlink();

  if (!preconfiguredDeployment) {
    provisionedActivationCode_ = String(activationCodeParam.getValue());
    provisionedActivationCode_.trim();
  }

  if (!preconfiguredDeployment && provisionedActivationCode_.isEmpty()) {
    setupRequired_ = true;
    provisioningPreferences_.putBool(PROVISIONING_SETUP_REQUIRED_KEY, true);
    Serial.println("Provisioning validation failed; activation code is required");
    return false;
  }

  const String configuredSsid = manager.getWiFiSSID();
  const String configuredPassword = manager.getWiFiPass();
  if (!configuredSsid.isEmpty()) {
    provisionedWifiSsid_ = configuredSsid;
    provisionedWifiPassword_ = configuredPassword;
    provisioningPreferences_.putString(PROVISIONING_WIFI_SSID_KEY, provisionedWifiSsid_);
    provisioningPreferences_.putString(PROVISIONING_WIFI_PASSWORD_KEY, provisionedWifiPassword_);
  }
  setupRequired_ = false;
  provisioningPreferences_.putBool(PROVISIONING_SETUP_REQUIRED_KEY, false);
  if (!preconfiguredDeployment) {
    provisioningPreferences_.putString(PROVISIONING_ACTIVATION_CODE_KEY, provisionedActivationCode_);
  }

  applyProvisioningOverrides();
  wifiDisconnectedSinceMs_ = 0;
  lastWifiAttemptMs_ = millis();

  if (!connected) {
    Serial.println("Setup portal closed without a successful Wi-Fi connection");
    return false;
  }

  Serial.println("Connecting to Wi-Fi...");
  Serial.printf("Provisioned Wi-Fi SSID: %s\n", provisionedWifiSsid_.c_str());
  if (!provisionedActivationCode_.isEmpty()) {
    Serial.println("Provisioned activation code saved");
  }
  Serial.printf("Provisioned IP: %s\n", WiFi.localIP().toString().c_str());
  WiFi.softAPdisconnect(true);
  WiFi.mode(WIFI_STA);
  return true;
}

void ReaderGatewayApp::clearStoredWifiCredentials() {
  if (!beginProvisioningStorage()) {
    return;
  }

  provisioningPreferences_.remove(PROVISIONING_WIFI_SSID_KEY);
  provisioningPreferences_.remove(PROVISIONING_WIFI_PASSWORD_KEY);
  provisioningPreferences_.putBool(PROVISIONING_SETUP_REQUIRED_KEY, true);
  provisionedWifiSsid_ = "";
  provisionedWifiPassword_ = "";
  setupRequired_ = true;
  WiFi.disconnect(true, true);
  WiFi.mode(WIFI_STA);
  wifiDisconnectedSinceMs_ = 0;
  lastWifiAttemptMs_ = 0;
}

void ReaderGatewayApp::updateOfflinePortalFallback() {
  if (!hasStoredWifiCredentials() || WiFi.status() == WL_CONNECTED) {
    wifiDisconnectedSinceMs_ = 0;
    return;
  }

  if (wifiDisconnectedSinceMs_ == 0) {
    wifiDisconnectedSinceMs_ = millis();
    return;
  }

  if (millis() - wifiDisconnectedSinceMs_ < SETUP_PORTAL_REOPEN_DELAY_MS) {
    return;
  }

  // Keep retrying with the stored credentials. Reopening the portal can interrupt
  // an otherwise recoverable deployment and is reserved for an explicit reset.
  wifiDisconnectedSinceMs_ = millis();
}

void ReaderGatewayApp::handleFactoryResetButton() {
  const bool pressed = digitalRead(FACTORY_RESET_BUTTON_PIN) == LOW;
  if (!pressed) {
    bootButtonPressedAtMs_ = 0;
    return;
  }

  if (bootButtonPressedAtMs_ == 0) {
    bootButtonPressedAtMs_ = millis();
    return;
  }

  if (millis() - bootButtonPressedAtMs_ < FACTORY_RESET_HOLD_MS) {
    return;
  }

  Serial.println("Factory reset button held for 10 seconds; clearing saved Wi-Fi");
  bootButtonPressedAtMs_ = 0;
  clearStoredWifiCredentials();
  openSetupPortal("Factory reset requested");
}

bool ReaderGatewayApp::consumeFactoryResetFlag() {
  if (!LittleFS.exists(FACTORY_RESET_FLAG_PATH)) {
    return false;
  }

  Serial.println("Factory reset flag detected");
  const bool queueCleared = offlineQueue_.clear();
  offlineQueueDepth_ = 0;
  wiegand_.reset();
  lastQueueAttemptMs_ = 0;
  lastHeartbeatMs_ = 0;
  lastOtaCheckMs_ = 0;
  lastSuccessfulApiContactAt_ = "";
  const bool flagRemoved = LittleFS.remove(FACTORY_RESET_FLAG_PATH);
  Serial.printf("Factory reset queue cleared: %s\n", queueCleared ? "yes" : "no");
  Serial.printf("Factory reset flag removed: %s\n", flagRemoved ? "yes" : "no");
  return true;
}

bool ReaderGatewayApp::checkRollbackState() {
  const esp_partition_t* running = esp_ota_get_running_partition();
  if (running == nullptr) {
    return false;
  }

  esp_ota_img_states_t otaState;
  if (esp_ota_get_state_partition(running, &otaState) != ESP_OK) {
    return false;
  }

  otaPendingRollbackConfirm_ = otaState == ESP_OTA_IMG_PENDING_VERIFY;
  if (otaPendingRollbackConfirm_) {
    loadPendingOtaManifest(pendingOtaManifest_);
    Serial.println("OTA image pending verification");
  }
  return otaPendingRollbackConfirm_;
}

bool ReaderGatewayApp::shouldDeferOtaUpdate() const {
  return transactionActive_ || otaUpdateInProgress_ || offlineQueueDepth_ > 0 || wiegand_.hasPendingFrame();
}

bool ReaderGatewayApp::verifyDownloadedFirmware(const String& digestHex, const ReaderOtaManifest& manifest) const {
  const String expectedSha = lowerTrimmed(manifest.sha256);
  if (expectedSha.isEmpty() || digestHex != expectedSha) {
    Serial.printf("OTA digest mismatch expected=%s actual=%s\n", expectedSha.c_str(), digestHex.c_str());
    return false;
  }

  if (!manifest.signatureAlgorithm.equalsIgnoreCase("ECDSA_P256_SHA256")) {
    Serial.printf("Unsupported OTA signature algorithm: %s\n", manifest.signatureAlgorithm.c_str());
    return false;
  }

  if (!config_.otaPublicKeyId.isEmpty() && manifest.publicKeyId != config_.otaPublicKeyId) {
    Serial.printf("OTA public key mismatch expected=%s actual=%s\n", config_.otaPublicKeyId.c_str(), manifest.publicKeyId.c_str());
    return false;
  }

  if (config_.otaPublicKeyPem.isEmpty()) {
    Serial.println("OTA public key is not configured");
    return false;
  }

  std::unique_ptr<uint8_t[]> signature;
  size_t signatureLength = 0;
  if (!decodeBase64(manifest.signature, signature, signatureLength)) {
    Serial.println("Failed to decode OTA signature");
    return false;
  }

  uint8_t digest[32];
  for (size_t index = 0; index < 32; index += 1) {
    const String byteHex = digestHex.substring(index * 2, index * 2 + 2);
    digest[index] = static_cast<uint8_t>(strtoul(byteHex.c_str(), nullptr, 16));
  }

  mbedtls_pk_context pk;
  mbedtls_pk_init(&pk);
  const int keyResult = mbedtls_pk_parse_public_key(
    &pk,
    reinterpret_cast<const unsigned char*>(config_.otaPublicKeyPem.c_str()),
    config_.otaPublicKeyPem.length() + 1
  );
  if (keyResult != 0) {
    Serial.printf("Failed to parse OTA public key: %d\n", keyResult);
    mbedtls_pk_free(&pk);
    return false;
  }

  const int verifyResult = mbedtls_pk_verify(&pk, MBEDTLS_MD_SHA256, digest, sizeof(digest), signature.get(), signatureLength);
  mbedtls_pk_free(&pk);
  if (verifyResult != 0) {
    Serial.printf("OTA signature verification failed: %d\n", verifyResult);
    return false;
  }

  return true;
}

void ReaderGatewayApp::reportOtaStatus(const String& status, const String& message, const ReaderOtaManifest& manifest) {
  if (config_.otaStatusPath.isEmpty()) {
    return;
  }

  ReaderOtaStatusReport report;
  report.releaseId = manifest.releaseId;
  report.fromVersion = config_.firmwareVersion;
  report.toVersion = manifest.version;
  report.status = status;
  report.message = message;

  ReaderApiResponse response;
  if (!gatewayClient_.reportOtaStatus(config_, report, response)) {
    Serial.printf("OTA status report failed: %s\n", status.c_str());
    return;
  }
  Serial.printf("OTA status reported: %s\n", status.c_str());
}

void ReaderGatewayApp::reportCommandStatus(
  const String& commandId,
  const String& status,
  const String& message,
  const String& firmwareVersion
) {
  if (commandId.isEmpty()) {
    return;
  }

  ReaderCommandStatusReport report;
  report.commandId = commandId;
  report.status = status;
  report.message = message;
  report.firmwareVersion = firmwareVersion;

  ReaderApiResponse response;
  if (!gatewayClient_.reportCommandStatus(config_, report, response)) {
    Serial.printf("Command status report failed: %s\n", status.c_str());
    return;
  }
  Serial.printf("Command status reported: %s\n", status.c_str());
}

bool ReaderGatewayApp::installCommandOtaUpdate(const ReaderApiResponse::ReaderPendingCommand& command) {
  if (command.id.isEmpty() || command.firmwareUrl.isEmpty()) {
    Serial.println("Command OTA skipped: missing command ID or firmware URL");
    return false;
  }

  otaUpdateInProgress_ = true;
  Serial.printf("Reader command received: id=%s type=%s version=%s\n",
    command.id.c_str(),
    command.type.c_str(),
    command.firmwareVersion.c_str());

  ReaderApiResponse ackResponse;
  if (!gatewayClient_.acknowledgeCommand(config_, command.id, ackResponse) || !ackResponse.success) {
    otaUpdateInProgress_ = false;
    Serial.printf("Command ack failed: %s\n", command.id.c_str());
    return false;
  }

  reportCommandStatus(command.id, "DOWNLOADING", "Downloading commanded firmware update.", command.firmwareVersion);
  Serial.printf("Firmware download started: %s\n", command.firmwareUrl.c_str());

  const String url = command.firmwareUrl;
  HTTPClient http;
  std::unique_ptr<WiFiClientSecure> secureClient;
  WiFiClient plainClient;
  if (url.startsWith("https://")) {
    secureClient.reset(new WiFiClientSecure());
    if (!config_.tlsRootCaPem.isEmpty()) {
      secureClient->setCACert(config_.tlsRootCaPem.c_str());
    } else if (config_.tlsInsecure) {
      secureClient->setInsecure();
    }
    if (!http.begin(*secureClient, url)) {
      Serial.printf("Command OTA HTTP begin failed for %s\n", url.c_str());
      logTlsError(*secureClient);
      otaUpdateInProgress_ = false;
      reportCommandStatus(command.id, "FAILED", "Failed to open commanded firmware URL.", command.firmwareVersion);
      return false;
    }
  } else if (!http.begin(plainClient, url)) {
    Serial.printf("Command OTA HTTP begin failed for %s\n", url.c_str());
    otaUpdateInProgress_ = false;
    reportCommandStatus(command.id, "FAILED", "Failed to open commanded firmware URL.", command.firmwareVersion);
    return false;
  }

  http.setTimeout(15000);
  http.addHeader("X-Device-Id", config_.deviceId);
  http.addHeader("X-Reader-Id", config_.readerId);
  http.addHeader("X-School-Id", config_.schoolId);
  http.addHeader("X-Firmware-Version", config_.firmwareVersion);
  http.addHeader("X-Firmware-Channel", config_.firmwareChannel);
  if (!config_.bearerToken.isEmpty()) {
    http.addHeader("Authorization", String("Bearer ") + config_.bearerToken);
  }

  const int statusCode = http.GET();
  if (statusCode != 200) {
    Serial.printf("Command OTA download failed with status %d\n", statusCode);
    if (statusCode < 0 && secureClient) {
      logTlsError(*secureClient);
    }
    http.end();
    otaUpdateInProgress_ = false;
    reportCommandStatus(command.id, "FAILED", "Commanded firmware download request failed.", command.firmwareVersion);
    return false;
  }

  const int contentLength = http.getSize();
  if (!Update.begin(contentLength > 0 ? static_cast<size_t>(contentLength) : UPDATE_SIZE_UNKNOWN, U_FLASH)) {
    Serial.printf("Command OTA Update.begin failed: %s\n", Update.errorString());
    http.end();
    otaUpdateInProgress_ = false;
    reportCommandStatus(command.id, "FAILED", "Commanded OTA partition init failed.", command.firmwareVersion);
    return false;
  }

  reportCommandStatus(command.id, "INSTALLING", "Installing commanded firmware update.", command.firmwareVersion);
  Serial.println("Firmware install started");

  WiFiClient* stream = http.getStreamPtr();
  mbedtls_sha256_context sha;
  mbedtls_sha256_init(&sha);
  mbedtls_sha256_starts_ret(&sha, 0);

  uint8_t buffer[1024];
  int remaining = contentLength;
  while (http.connected() && (remaining > 0 || remaining == -1)) {
    const size_t available = stream->available();
    if (available == 0) {
      delay(1);
      yield();
      continue;
    }

    const size_t chunkSize = available > sizeof(buffer) ? sizeof(buffer) : available;
    const int bytesRead = stream->readBytes(reinterpret_cast<char*>(buffer), chunkSize);
    if (bytesRead <= 0) {
      continue;
    }

    mbedtls_sha256_update_ret(&sha, buffer, static_cast<size_t>(bytesRead));
    if (Update.write(buffer, static_cast<size_t>(bytesRead)) != static_cast<size_t>(bytesRead)) {
      Serial.printf("Command OTA write failed: %s\n", Update.errorString());
      mbedtls_sha256_free(&sha);
      Update.abort();
      http.end();
      otaUpdateInProgress_ = false;
      reportCommandStatus(command.id, "FAILED", "Commanded OTA write failed.", command.firmwareVersion);
      return false;
    }

    if (remaining > 0) {
      remaining -= bytesRead;
    }
    yield();
  }

  uint8_t digest[32];
  mbedtls_sha256_finish_ret(&sha, digest);
  mbedtls_sha256_free(&sha);
  const String digestHex = lowerTrimmed(digestToHex(digest));
  const String expectedSha = lowerTrimmed(command.firmwareSha256);

  if (remaining > 0) {
    Update.abort();
    http.end();
    otaUpdateInProgress_ = false;
    reportCommandStatus(command.id, "FAILED", "Commanded OTA download ended early.", command.firmwareVersion);
    return false;
  }

  if (!expectedSha.isEmpty() && digestHex != expectedSha) {
    Serial.printf("Command OTA SHA mismatch expected=%s actual=%s\n", expectedSha.c_str(), digestHex.c_str());
    Update.abort();
    http.end();
    otaUpdateInProgress_ = false;
    reportCommandStatus(command.id, "FAILED", "Commanded OTA SHA-256 verification failed.", command.firmwareVersion);
    return false;
  }

  if (!Update.end(true) || !Update.isFinished()) {
    Serial.printf("Command OTA finalize failed: %s\n", Update.errorString());
    http.end();
    otaUpdateInProgress_ = false;
    reportCommandStatus(command.id, "FAILED", "Commanded OTA finalize failed.", command.firmwareVersion);
    return false;
  }

  http.end();
  Serial.printf("Firmware install success: %s -> %s\n", config_.firmwareVersion.c_str(), command.firmwareVersion.c_str());
  reportCommandStatus(command.id, "SUCCEEDED", "Commanded firmware update installed successfully. Rebooting.", command.firmwareVersion);
  delay(250);
  ESP.restart();
  return true;
}

bool ReaderGatewayApp::installOtaUpdate(const ReaderOtaManifest& manifest) {
  if (shouldDeferOtaUpdate()) {
    reportOtaStatus("DEFERRED", "Reader transaction is active; OTA deferred.", manifest);
    return false;
  }

  otaUpdateInProgress_ = true;
  reportOtaStatus("DOWNLOADING", "Downloading firmware update.", manifest);

  const String url = manifest.downloadUrl.isEmpty()
    ? joinPath(config_.apiBaseUrl, manifest.downloadPath)
    : manifest.downloadUrl;

  HTTPClient http;
  std::unique_ptr<WiFiClientSecure> secureClient;
  WiFiClient plainClient;
  if (url.startsWith("https://")) {
    secureClient.reset(new WiFiClientSecure());
    if (!config_.tlsRootCaPem.isEmpty()) {
      secureClient->setCACert(config_.tlsRootCaPem.c_str());
    } else if (config_.tlsInsecure) {
      secureClient->setInsecure();
      Serial.println("Warning: OTA TLS is running in insecure mode; signature verification remains mandatory.");
    }
    if (!http.begin(*secureClient, url)) {
      Serial.printf("OTA HTTP begin failed for %s\n", url.c_str());
      logTlsError(*secureClient);
      otaUpdateInProgress_ = false;
      reportOtaStatus("FAILED", "Failed to open OTA download URL.", manifest);
      return false;
    }
  } else if (!http.begin(plainClient, url)) {
    Serial.printf("OTA HTTP begin failed for %s\n", url.c_str());
    otaUpdateInProgress_ = false;
    reportOtaStatus("FAILED", "Failed to open OTA download URL.", manifest);
    return false;
  }

  http.setTimeout(15000);
  http.addHeader("X-Device-Id", config_.deviceId);
  http.addHeader("X-Reader-Id", config_.readerId);
  http.addHeader("X-School-Id", config_.schoolId);
  http.addHeader("X-Firmware-Version", config_.firmwareVersion);
  http.addHeader("X-Firmware-Channel", config_.firmwareChannel);
  if (!config_.bearerToken.isEmpty()) {
    http.addHeader("Authorization", String("Bearer ") + config_.bearerToken);
  }

  const int statusCode = http.GET();
  if (statusCode != 200) {
    Serial.printf("OTA download failed with status %d\n", statusCode);
    if (statusCode < 0 && secureClient) {
      logTlsError(*secureClient);
    }
    http.end();
    otaUpdateInProgress_ = false;
    reportOtaStatus("FAILED", "OTA download request failed.", manifest);
    return false;
  }

  const int contentLength = http.getSize();
  if (manifest.sizeBytes > 0 && contentLength > 0 && static_cast<uint32_t>(contentLength) != manifest.sizeBytes) {
    Serial.printf("OTA size mismatch expected=%lu actual=%d\n", static_cast<unsigned long>(manifest.sizeBytes), contentLength);
    http.end();
    otaUpdateInProgress_ = false;
    reportOtaStatus("FAILED", "OTA size mismatch.", manifest);
    return false;
  }

  if (!Update.begin(manifest.sizeBytes > 0 ? manifest.sizeBytes : UPDATE_SIZE_UNKNOWN, U_FLASH)) {
    Serial.printf("OTA Update.begin failed: %s\n", Update.errorString());
    http.end();
    otaUpdateInProgress_ = false;
    reportOtaStatus("FAILED", "OTA partition init failed.", manifest);
    return false;
  }

  reportOtaStatus("VERIFYING", "Streaming firmware and computing SHA-256.", manifest);

  WiFiClient* stream = http.getStreamPtr();
  mbedtls_sha256_context sha;
  mbedtls_sha256_init(&sha);
  mbedtls_sha256_starts_ret(&sha, 0);

  uint8_t buffer[1024];
  int remaining = contentLength;
  while (http.connected() && (remaining > 0 || remaining == -1)) {
    const size_t available = stream->available();
    if (available == 0) {
      delay(1);
      yield();
      continue;
    }

    const size_t chunkSize = available > sizeof(buffer) ? sizeof(buffer) : available;
    const int bytesRead = stream->readBytes(reinterpret_cast<char*>(buffer), chunkSize);
    if (bytesRead <= 0) {
      continue;
    }

    mbedtls_sha256_update_ret(&sha, buffer, static_cast<size_t>(bytesRead));
    if (Update.write(buffer, static_cast<size_t>(bytesRead)) != static_cast<size_t>(bytesRead)) {
      Serial.printf("OTA write failed: %s\n", Update.errorString());
      mbedtls_sha256_free(&sha);
      Update.abort();
      http.end();
      otaUpdateInProgress_ = false;
      reportOtaStatus("FAILED", "OTA write failed.", manifest);
      return false;
    }

    if (remaining > 0) {
      remaining -= bytesRead;
    }
    yield();
  }

  uint8_t digest[32];
  mbedtls_sha256_finish_ret(&sha, digest);
  mbedtls_sha256_free(&sha);
  const String digestHex = digestToHex(digest);

  if (remaining > 0) {
    Serial.println("OTA download ended before expected size was received");
    Update.abort();
    http.end();
    otaUpdateInProgress_ = false;
    reportOtaStatus("FAILED", "OTA download ended early.", manifest);
    return false;
  }

  if (!verifyDownloadedFirmware(digestHex, manifest)) {
    Update.abort();
    http.end();
    otaUpdateInProgress_ = false;
    reportOtaStatus("FAILED", "OTA digest or signature verification failed.", manifest);
    return false;
  }

  reportOtaStatus("INSTALLING", "Verified firmware image; switching boot partition.", manifest);
  if (!Update.end(true) || !Update.isFinished()) {
    Serial.printf("OTA finalize failed: %s\n", Update.errorString());
    http.end();
    otaUpdateInProgress_ = false;
    reportOtaStatus("FAILED", "OTA finalize failed.", manifest);
    return false;
  }

  http.end();
  pendingOtaManifest_ = manifest;
  if (!savePendingOtaManifest(manifest)) {
    otaUpdateInProgress_ = false;
    reportOtaStatus("FAILED", "Failed to persist OTA pending state before reboot.", manifest);
    return false;
  }
  Serial.printf("OTA installed successfully: %s -> %s\n", config_.firmwareVersion.c_str(), manifest.version.c_str());
  delay(250);
  ESP.restart();
  return true;
}

void ReaderGatewayApp::maybeCheckForOtaUpdate() {
  if (!hasWorkingNetwork() || config_.otaCheckPath.isEmpty() || config_.otaPublicKeyPem.isEmpty()) {
    return;
  }

  const unsigned long now = millis();
  if (now - lastOtaCheckMs_ < config_.otaCheckIntervalMs) {
    return;
  }
  lastOtaCheckMs_ = now;

  ReaderOtaManifest manifest;
  if (!gatewayClient_.checkForOtaUpdate(config_, offlineQueueDepth_, manifest)) {
    Serial.println("OTA check failed");
    return;
  }

  markApiContact();

  if (!manifest.updateAvailable) {
    Serial.println("OTA: no update available");
    return;
  }

  Serial.printf("OTA available release=%s version=%s channel=%s\n",
    manifest.releaseId.c_str(),
    manifest.version.c_str(),
    manifest.channel.c_str());

  if (shouldDeferOtaUpdate()) {
    reportOtaStatus("DEFERRED", "Reader transaction is active; OTA deferred.", manifest);
    return;
  }

  installOtaUpdate(manifest);
}

void ReaderGatewayApp::maybeConfirmOtaBoot() {
  if (!otaPendingRollbackConfirm_ || lastSuccessfulApiContactAt_.isEmpty()) {
    return;
  }

  if (esp_ota_mark_app_valid_cancel_rollback() == ESP_OK) {
    otaPendingRollbackConfirm_ = false;
    Serial.println("OTA image marked valid");
    if (!pendingOtaManifest_.releaseId.isEmpty()) {
      reportOtaStatus("CONFIRMED", "OTA reboot confirmed after successful backend contact.", pendingOtaManifest_);
      clearPendingOtaManifest();
      pendingOtaManifest_ = ReaderOtaManifest{};
    }
  } else {
    Serial.println("Failed to mark OTA image valid");
  }
}

bool ReaderGatewayApp::isValidScanEvent(const ReaderScanEvent& event, const char*& reason) const {
  reason = nullptr;

  if (event.rawWiegandBitCount == 0) {
    reason = "no pulses received";
    return false;
  }
  if (event.rawWiegandBitCount != 26 && event.rawWiegandBitCount != 34) {
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

bool ReaderGatewayApp::shouldSuppressDuplicateScan(const ReaderScanEvent& event) const {
  if (lastAcceptedScanAtMs_ == 0) {
    return false;
  }
  if (event.readerId != lastAcceptedReaderId_ || event.credential != lastAcceptedCredential_) {
    return false;
  }
  return millis() - lastAcceptedScanAtMs_ < DUPLICATE_SUPPRESSION_WINDOW_MS;
}

void ReaderGatewayApp::rememberAcceptedScan(const ReaderScanEvent& event) {
  lastAcceptedCredential_ = event.credential;
  lastAcceptedReaderId_ = event.readerId;
  lastAcceptedScanAtMs_ = millis();
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
  pinMode(FACTORY_RESET_BUTTON_PIN, INPUT_PULLUP);
  pinMode(SETUP_LED_PIN, OUTPUT);
  digitalWrite(SETUP_LED_PIN, SETUP_LED_IDLE_LEVEL);

  if (!configManager_.begin()) {
    Serial.println("Config storage init failed");
    return false;
  }
  if (!offlineQueue_.begin()) {
    Serial.println("Offline queue init failed");
    return false;
  }
  offlineQueueDepth_ = offlineQueue_.size();
  consumeFactoryResetFlag();

  config_ = ConfigManager::defaults();
  const bool configLoaded = configManager_.load(config_);
  loadProvisioningState();
  applyProvisioningOverrides();
  normalizeRegistrationMode();
  if (isLocalApiBaseUrl(config_.apiBaseUrl) && !isLocalApiBaseUrl(String(SSAMENJ_GATEWAY_DEFAULT_API_BASE_URL))) {
    config_.apiBaseUrl = SSAMENJ_GATEWAY_DEFAULT_API_BASE_URL;
    persistAssignedConfiguration();
    Serial.printf("Migrated stored apiBaseUrl to production default: %s\n", config_.apiBaseUrl.c_str());
  }
  Serial.println(configLoaded ? "Config load complete" : "Config load failed; using defaults");
  Serial.printf("Loaded readerId: %s\n", config_.readerId.c_str());
  Serial.printf("Loaded schoolId: %s\n", config_.schoolId.c_str());
  Serial.printf("Loaded apiBaseUrl: %s\n", config_.apiBaseUrl.c_str());
  Serial.printf("Loaded firmwareChannel: %s\n", config_.firmwareChannel.c_str());
  Serial.printf("Loaded otaPublicKeyId: %s\n", config_.otaPublicKeyId.isEmpty() ? "(blank)" : config_.otaPublicKeyId.c_str());
  Serial.printf("OTA public key configured: %s\n", config_.otaPublicKeyPem.isEmpty() ? "no" : "yes");
  Serial.printf("Wi-Fi SSID configured: %s\n", configuredWifiSsid().c_str());
  Serial.printf("Configured D0 pin: %d\n", static_cast<int>(config_.d0Pin));
  Serial.printf("Configured D1 pin: %d\n", static_cast<int>(config_.d1Pin));
  if (!provisionedActivationCode_.isEmpty()) {
    Serial.println("Provisioned activation code is stored");
  }

  checkRollbackState();
  feedback_.begin(config_);
  gatewayClient_.begin(config_);
  deviceRegistration_.begin(&gatewayClient_, &config_);
  wiegand_.begin(config_.d0Pin, config_.d1Pin, config_.wiegandTimeoutMs);

  if (!hasStoredWifiCredentials()) {
    openSetupPortal("No saved Wi-Fi credentials were found");
  }

  ensureWiFi();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Wi-Fi connected");
    syncClock();
    ReaderRegistrationResult registration;
    if (config_.autoRegister && deviceRegistration_.registerNow(&registration)) {
      Serial.println("Verifying school code...");
      Serial.println("Registering reader...");
      applyRegistrationResult(registration);
      markApiContact();
    } else if (config_.autoRegister) {
      Serial.println("Assignment Pending");
    }
    processOfflineQueue();
  }

  return true;
}

void ReaderGatewayApp::ensureWiFi() {
  if (!hasStoredWifiCredentials()) {
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
  Serial.printf("Connecting to SSID: %s\n", configuredWifiSsid().c_str());
  WiFi.disconnect(true);
  WiFi.begin(configuredWifiSsid().c_str(), configuredWifiPassword().c_str());
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

bool ReaderGatewayApp::hasWorkingNetwork() const {
  return WiFi.status() == WL_CONNECTED;
}

String ReaderGatewayApp::utcIso8601Now() const {
  if (!clockSynced_ && !isTimeValid()) {
    return "1970-01-01T00:00:00Z";
  }

  struct tm timeInfo {};
  if (!getLocalTime(&timeInfo, 0)) {
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
  maybeConfirmOtaBoot();
}

void ReaderGatewayApp::maybeProcessPendingCommand(const ReaderApiResponse& response) {
  if (!response.hasCommand) {
    return;
  }
  if (!response.command.type.equalsIgnoreCase("FIRMWARE_UPDATE")) {
    Serial.printf("Reader command ignored: unsupported type=%s\n", response.command.type.c_str());
    return;
  }
  if (shouldDeferOtaUpdate()) {
    Serial.printf("Reader command deferred: id=%s queueDepth=%u transactionActive=%s pendingFrame=%s\n",
      response.command.id.c_str(),
      static_cast<unsigned int>(offlineQueueDepth_),
      transactionActive_ ? "true" : "false",
      wiegand_.hasPendingFrame() ? "true" : "false");
    return;
  }
  installCommandOtaUpdate(response.command);
}

void ReaderGatewayApp::sendHeartbeat() {
  if (!hasWorkingNetwork() || offlineQueueDepth_ > 0 || wiegand_.hasPendingFrame()) {
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
  metrics.rebootReason = resetReasonToString(esp_reset_reason());
  metrics.queueDepth = offlineQueueDepth_;
  metrics.lastSuccessfulApiContactAt = lastSuccessfulApiContactAt_;

  ReaderApiResponse response;
  if (gatewayClient_.postHeartbeat(config_, metrics, response) && response.success) {
    markApiContact();
    maybeProcessPendingCommand(response);
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
    return;
  }

  event.readerId = config_.readerId;
  if (shouldSuppressDuplicateScan(event)) {
    Serial.printf(
      "Duplicate suppressed: readerId=%s credential=%s windowMs=%lu\n",
      event.readerId.c_str(),
      event.credential.c_str(),
      static_cast<unsigned long>(DUPLICATE_SUPPRESSION_WINDOW_MS)
    );
    return;
  }

  event.eventId = createEventId();
  event.deviceTime = utcIso8601Now();
  event.schoolId = config_.schoolId;
  event.deviceId = config_.deviceId;
  event.firmwareVersion = config_.firmwareVersion;
  event.retryCount = 0;
  event.syncStatus = "pending";

  Serial.printf(
    "Reader scan accepted: timestamp=%s readerId=%s bitCount=%u rawBinary=%s rawDecimal=%s rawHex=%s facilityCode=%s cardNumber=%s parity=ok credential=%s\n",
    event.deviceTime.c_str(),
    event.readerId.c_str(),
    static_cast<unsigned int>(event.rawWiegandBitCount),
    event.rawWiegandBinary.c_str(),
    event.rawWiegandDecimal.c_str(),
    event.rawWiegandHex.c_str(),
    event.facilityCode.isEmpty() ? "-" : event.facilityCode.c_str(),
    event.cardNumber.isEmpty() ? "-" : event.cardNumber.c_str(),
    event.credential.c_str()
  );

  if (offlineQueue_.enqueue(event)) {
    rememberAcceptedScan(event);
    offlineQueueDepth_ += 1;
    Serial.println("Queued scan for delivery");
    Serial.printf("Queue status after enqueue: %u\n", static_cast<unsigned int>(offlineQueueDepth_));
    if (!hasWorkingNetwork()) {
      Serial.printf(
        "SERVER_BEEP=queued STATUS=OFFLINE_QUEUED HTTP=%d SELECTED_PATTERN=%s credential=%s\n",
        0,
        toneName(GatewayFeedbackTone::Queued),
        event.credential.c_str()
      );
      feedback_.play(GatewayFeedbackTone::Queued);
    }
    return;
  }

  Serial.println("Offline queue write failed; attempting direct upload fallback");
  if (!hasWorkingNetwork()) {
    feedback_.play(GatewayFeedbackTone::Error);
    return;
  }

  transactionActive_ = true;
  ReaderApiResponse response;
  gatewayClient_.postScan(config_, event, response);
  transactionActive_ = false;
  if (isTerminalApiResponse(response)) {
    rememberAcceptedScan(event);
    markApiContact();
    Serial.println(response.success ? "Upload Success" : "Scan Rejected");
    const GatewayFeedbackTone tone = toneFromResponse(response);
    Serial.printf(
      "SERVER_BEEP=%s STATUS=%s HTTP=%d SELECTED_PATTERN=%s credential=%s\n",
      response.beep.c_str(),
      response.status.c_str(),
      response.statusCode,
      toneName(tone),
      event.credential.c_str()
    );
    feedback_.play(tone);
    return;
  }

  Serial.println("Upload Failed");
  Serial.printf(
    "SERVER_BEEP=queued STATUS=OFFLINE_QUEUED HTTP=%d SELECTED_PATTERN=%s credential=%s\n",
    response.statusCode,
    toneName(GatewayFeedbackTone::Queued),
    event.credential.c_str()
  );
  feedback_.play(GatewayFeedbackTone::Queued);
}

void ReaderGatewayApp::processOfflineQueue() {
  if (!hasWorkingNetwork()) {
    return;
  }

  ReaderScanEvent event;
  if (!offlineQueue_.peek(event)) {
    return;
  }

  const char* invalidReason = nullptr;
  if (!isValidScanEvent(event, invalidReason)) {
    Serial.printf("Dropped queued event: %s\n", invalidReason == nullptr ? "invalid event" : invalidReason);
    if (offlineQueue_.pop() && offlineQueueDepth_ > 0) {
      offlineQueueDepth_ -= 1;
    }
    Serial.printf("Queue status after drop: %u\n", static_cast<unsigned int>(offlineQueueDepth_));
    return;
  }

  const unsigned long retryDelayMs = retryDelayFor(event);
  if (event.retryCount > 0 && millis() - lastQueueAttemptMs_ < retryDelayMs) {
    return;
  }
  lastQueueAttemptMs_ = millis();

  transactionActive_ = true;
  ReaderApiResponse response;
  gatewayClient_.postScan(config_, event, response);
  transactionActive_ = false;
  if (!isTerminalApiResponse(response)) {
    event.retryCount += 1;
    event.syncStatus = "pending";
    offlineQueue_.updateFront(event);
    Serial.printf("Upload Failed; retryCount=%lu nextRetryMs=%lu\n", static_cast<unsigned long>(event.retryCount), retryDelayFor(event));
    Serial.printf("Queue status pending retry: %u\n", static_cast<unsigned int>(offlineQueueDepth_));
    return;
  }

  if (offlineQueue_.pop() && offlineQueueDepth_ > 0) {
    offlineQueueDepth_ -= 1;
  }
  lastQueueAttemptMs_ = 0;
  markApiContact();
  Serial.printf("Queue status after dequeue: %u\n", static_cast<unsigned int>(offlineQueueDepth_));
  if (response.success) {
    Serial.println("Upload Success");
  } else {
    Serial.printf("Dropped queued event after permanent API response: status=%d action=%s message=%s\n",
      response.statusCode,
      response.action.c_str(),
      response.message.c_str());
  }
  const GatewayFeedbackTone tone = toneFromResponse(response);
  Serial.printf(
    "SERVER_BEEP=%s STATUS=%s HTTP=%d SELECTED_PATTERN=%s credential=%s\n",
    response.beep.c_str(),
    response.status.c_str(),
    response.statusCode,
    toneName(tone),
    event.credential.c_str()
  );
  feedback_.play(tone);
}

void ReaderGatewayApp::loop() {
  feedback_.loop();
  handleFactoryResetButton();
  ReaderScanEvent event;
  if (wiegand_.poll(event)) {
    processScan(event);
  }
  ensureWiFi();
  updateOfflinePortalFallback();

  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiConnectedLogged_) {
      Serial.println("Wi-Fi Connected");
      Serial.printf("Wi-Fi state: %s (%d)\n", wifiStatusToString(WiFi.status()), static_cast<int>(WiFi.status()));
      Serial.printf("Wi-Fi IP: %s\n", WiFi.localIP().toString().c_str());
      Serial.printf("Wi-Fi RSSI: %d dBm\n", WiFi.RSSI());
      wifiConnectedLogged_ = true;
      Serial.println("Wi-Fi connected");
      syncClock();
      ReaderRegistrationResult registration;
      if (config_.autoRegister && deviceRegistration_.registerNow(&registration)) {
        Serial.println("Verifying school code...");
        Serial.println("Registering reader...");
        applyRegistrationResult(registration);
        markApiContact();
      } else if (config_.autoRegister) {
        Serial.println("Assignment Pending");
      }
    }
    processOfflineQueue();
    if (!wiegand_.hasPendingFrame() && offlineQueueDepth_ == 0) {
      sendHeartbeat();
      maybeCheckForOtaUpdate();
    }
  } else {
    if (wifiConnectedLogged_) {
      Serial.printf("Wi-Fi state: %s (%d)\n", wifiStatusToString(WiFi.status()), static_cast<int>(WiFi.status()));
    }
    wifiConnectedLogged_ = false;
  }

  if (WiFi.status() == WL_CONNECTED && deviceRegistration_.shouldRegister(millis())) {
    ReaderRegistrationResult registration;
    if (deviceRegistration_.registerNow(&registration)) {
      Serial.println("Registering reader...");
      applyRegistrationResult(registration);
      markApiContact();
    } else {
      Serial.println("Server unavailable; setup saved and retrying");
    }
  }
}
