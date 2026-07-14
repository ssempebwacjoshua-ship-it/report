#include "ssamenj/ConfigManager.h"

#include <LittleFS.h>
#include <ArduinoJson.h>

namespace {
String defaultDeviceId() {
  const uint64_t mac = ESP.getEfuseMac();
  char buffer[24];
  snprintf(buffer, sizeof(buffer), "reader-gateway-%06llX", static_cast<unsigned long long>(mac & 0xFFFFFFULL));
  return String(buffer);
}
}  // namespace

ConfigManager::ConfigManager(const char* path) : path_(path) {}

bool ConfigManager::begin() {
  if (!LittleFS.begin(true)) {
    return false;
  }
  if (!LittleFS.exists("/reader-gateway")) {
    LittleFS.mkdir("/reader-gateway");
  }
  return true;
}

ReaderGatewayConfig ConfigManager::defaults() {
  ReaderGatewayConfig config;
  config.deviceId = defaultDeviceId();
  config.schoolId = "";
  config.readerId = config.deviceId;
  config.deviceName = config.deviceId;
  config.readerLocation = "";
  config.readerType = "";
  config.activationCode = "";
  config.firmwareChannel = SSAMENJ_GATEWAY_DEFAULT_FIRMWARE_CHANNEL;
  config.apiBaseUrl = SSAMENJ_GATEWAY_DEFAULT_API_BASE_URL;
  config.eventsPath = "/api/readers/events";
  config.registrationPath = "/api/readers/activate";
  config.heartbeatPath = "/api/readers/heartbeat";
  config.otaCheckPath = "/api/readers/ota/check";
  config.otaStatusPath = "/api/readers/ota/status";
  config.bearerToken = SSAMENJ_GATEWAY_DEFAULT_PROVISIONING_TOKEN;
  config.firmwareVersion = SSAMENJ_GATEWAY_VERSION;
  config.ntpServer = "pool.ntp.org";
  config.otaPublicKeyPem = "";
  config.otaPublicKeyId = "";
  config.tlsRootCaPem = "";
  config.retryIntervalMs = 10000;
  config.wifiReconnectIntervalMs = 15000;
  config.wiegandTimeoutMs = 30;
  config.timeSyncTimeoutMs = 5000;
  config.otaCheckIntervalMs = 3600000;
  config.d0Pin = 18;
  config.d1Pin = 19;
  config.buzzerPin = -1;
  config.ledPin = -1;
  config.tlsInsecure = true;
  config.autoRegister = true;
  config.feedbackOutputsEnabled = false;
  config.feedbackDriverActiveHigh = false;
  return config;
}

bool ConfigManager::load(ReaderGatewayConfig& config) {
  config = defaults();
  if (!LittleFS.exists(path_)) {
    Serial.printf("Config file missing, creating defaults at %s\n", path_.c_str());
    const bool saved = save(config);
    if (saved) {
      Serial.println("Config file created with defaults");
    } else {
      Serial.println("Failed to create default config file");
    }
    return saved;
  }

  Serial.printf("Loading config from %s\n", path_.c_str());
  File file = LittleFS.open(path_, FILE_READ);
  if (!file) {
    Serial.println("Failed to open config file for reading");
    return false;
  }

  JsonDocument doc;
  const DeserializationError error = deserializeJson(doc, file);
  file.close();
  if (error) {
    Serial.printf("Failed to parse config JSON: %s\n", error.c_str());
    return false;
  }

  config.deviceId = doc["deviceId"] | config.deviceId;
  config.schoolId = doc["schoolId"] | config.schoolId;
  config.readerId = doc["readerId"] | config.readerId;
  config.deviceName = doc["deviceName"] | config.deviceName;
  config.readerLocation = doc["readerLocation"] | config.readerLocation;
  config.readerType = doc["readerType"] | config.readerType;
  config.activationCode = doc["activationCode"] | config.activationCode;
  config.firmwareChannel = doc["firmwareChannel"] | config.firmwareChannel;
  config.wifiSsid = doc["wifiSsid"] | config.wifiSsid;
  config.wifiPassword = doc["wifiPassword"] | config.wifiPassword;
  config.apiBaseUrl = doc["apiBaseUrl"] | config.apiBaseUrl;
  config.eventsPath = doc["eventsPath"] | config.eventsPath;
  config.registrationPath = doc["registrationPath"] | config.registrationPath;
  config.heartbeatPath = doc["heartbeatPath"] | config.heartbeatPath;
  config.otaCheckPath = doc["otaCheckPath"] | config.otaCheckPath;
  config.otaStatusPath = doc["otaStatusPath"] | config.otaStatusPath;
  config.bearerToken = doc["bearerToken"] | config.bearerToken;
  config.firmwareVersion = doc["firmwareVersion"] | config.firmwareVersion;
  config.ntpServer = doc["ntpServer"] | config.ntpServer;
  config.otaPublicKeyPem = doc["otaPublicKeyPem"] | config.otaPublicKeyPem;
  config.otaPublicKeyId = doc["otaPublicKeyId"] | config.otaPublicKeyId;
  config.tlsRootCaPem = doc["tlsRootCaPem"] | config.tlsRootCaPem;
  config.retryIntervalMs = doc["retryIntervalMs"] | config.retryIntervalMs;
  config.wifiReconnectIntervalMs = doc["wifiReconnectIntervalMs"] | config.wifiReconnectIntervalMs;
  config.wiegandTimeoutMs = doc["wiegandTimeoutMs"] | config.wiegandTimeoutMs;
  config.timeSyncTimeoutMs = doc["timeSyncTimeoutMs"] | config.timeSyncTimeoutMs;
  config.otaCheckIntervalMs = doc["otaCheckIntervalMs"] | config.otaCheckIntervalMs;
  config.d0Pin = doc["d0Pin"] | config.d0Pin;
  config.d1Pin = doc["d1Pin"] | config.d1Pin;
  config.buzzerPin = doc["buzzerPin"] | config.buzzerPin;
  config.ledPin = doc["ledPin"] | config.ledPin;
  config.tlsInsecure = doc["tlsInsecure"] | config.tlsInsecure;
  config.autoRegister = doc["autoRegister"] | config.autoRegister;
  config.feedbackOutputsEnabled = doc["feedbackOutputsEnabled"] | config.feedbackOutputsEnabled;
  config.feedbackDriverActiveHigh = doc["feedbackDriverActiveHigh"] | config.feedbackDriverActiveHigh;
  Serial.println("Config loaded from LittleFS");
  return true;
}

bool ConfigManager::save(const ReaderGatewayConfig& config) {
  JsonDocument doc;
  doc["deviceId"] = config.deviceId;
  doc["schoolId"] = config.schoolId;
  doc["readerId"] = config.readerId;
  doc["deviceName"] = config.deviceName;
  doc["readerLocation"] = config.readerLocation;
  doc["readerType"] = config.readerType;
  doc["activationCode"] = config.activationCode;
  doc["firmwareChannel"] = config.firmwareChannel;
  doc["wifiSsid"] = config.wifiSsid;
  doc["wifiPassword"] = config.wifiPassword;
  doc["apiBaseUrl"] = config.apiBaseUrl;
  doc["eventsPath"] = config.eventsPath;
  doc["registrationPath"] = config.registrationPath;
  doc["heartbeatPath"] = config.heartbeatPath;
  doc["otaCheckPath"] = config.otaCheckPath;
  doc["otaStatusPath"] = config.otaStatusPath;
  doc["bearerToken"] = config.bearerToken;
  doc["firmwareVersion"] = config.firmwareVersion;
  doc["ntpServer"] = config.ntpServer;
  doc["otaPublicKeyPem"] = config.otaPublicKeyPem;
  doc["otaPublicKeyId"] = config.otaPublicKeyId;
  doc["tlsRootCaPem"] = config.tlsRootCaPem;
  doc["retryIntervalMs"] = config.retryIntervalMs;
  doc["wifiReconnectIntervalMs"] = config.wifiReconnectIntervalMs;
  doc["wiegandTimeoutMs"] = config.wiegandTimeoutMs;
  doc["timeSyncTimeoutMs"] = config.timeSyncTimeoutMs;
  doc["otaCheckIntervalMs"] = config.otaCheckIntervalMs;
  doc["d0Pin"] = config.d0Pin;
  doc["d1Pin"] = config.d1Pin;
  doc["buzzerPin"] = config.buzzerPin;
  doc["ledPin"] = config.ledPin;
  doc["tlsInsecure"] = config.tlsInsecure;
  doc["autoRegister"] = config.autoRegister;
  doc["feedbackOutputsEnabled"] = config.feedbackOutputsEnabled;
  doc["feedbackDriverActiveHigh"] = config.feedbackDriverActiveHigh;

  File file = LittleFS.open(path_, FILE_WRITE);
  if (!file) {
    return false;
  }

  const bool ok = serializeJsonPretty(doc, file) > 0;
  file.close();
  return ok;
}
