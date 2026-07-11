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
  config.schoolId = "school-001";
  config.readerId = "attendance-gate-01";
  config.apiBaseUrl = "https://school-connect.example.com";
  config.eventsPath = "/api/readers/events";
  config.registrationPath = "/api/readers/register";
  config.heartbeatPath = "/api/readers/heartbeat";
  config.bearerToken = "";
  config.firmwareVersion = SSAMENJ_GATEWAY_VERSION;
  config.ntpServer = "pool.ntp.org";
  config.otaPassword = "";
  config.tlsRootCaPem = "";
  config.retryIntervalMs = 10000;
  config.wifiReconnectIntervalMs = 15000;
  config.wiegandTimeoutMs = 30;
  config.timeSyncTimeoutMs = 5000;
  config.d0Pin = 4;
  config.d1Pin = 5;
  config.buzzerPin = -1;
  config.ledPin = -1;
  config.tlsInsecure = true;
  config.autoRegister = true;
  config.feedbackOutputsEnabled = false;
  config.feedbackDriverActiveHigh = true;
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
  config.wifiSsid = doc["wifiSsid"] | config.wifiSsid;
  config.wifiPassword = doc["wifiPassword"] | config.wifiPassword;
  config.apiBaseUrl = doc["apiBaseUrl"] | config.apiBaseUrl;
  config.eventsPath = doc["eventsPath"] | config.eventsPath;
  config.registrationPath = doc["registrationPath"] | config.registrationPath;
  config.heartbeatPath = doc["heartbeatPath"] | config.heartbeatPath;
  config.bearerToken = doc["bearerToken"] | config.bearerToken;
  config.firmwareVersion = doc["firmwareVersion"] | config.firmwareVersion;
  config.ntpServer = doc["ntpServer"] | config.ntpServer;
  config.otaPassword = doc["otaPassword"] | config.otaPassword;
  config.tlsRootCaPem = doc["tlsRootCaPem"] | config.tlsRootCaPem;
  config.retryIntervalMs = doc["retryIntervalMs"] | config.retryIntervalMs;
  config.wifiReconnectIntervalMs = doc["wifiReconnectIntervalMs"] | config.wifiReconnectIntervalMs;
  config.wiegandTimeoutMs = doc["wiegandTimeoutMs"] | config.wiegandTimeoutMs;
  config.timeSyncTimeoutMs = doc["timeSyncTimeoutMs"] | config.timeSyncTimeoutMs;
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
  doc["wifiSsid"] = config.wifiSsid;
  doc["wifiPassword"] = config.wifiPassword;
  doc["apiBaseUrl"] = config.apiBaseUrl;
  doc["eventsPath"] = config.eventsPath;
  doc["registrationPath"] = config.registrationPath;
  doc["heartbeatPath"] = config.heartbeatPath;
  doc["bearerToken"] = config.bearerToken;
  doc["firmwareVersion"] = config.firmwareVersion;
  doc["ntpServer"] = config.ntpServer;
  doc["otaPassword"] = config.otaPassword;
  doc["tlsRootCaPem"] = config.tlsRootCaPem;
  doc["retryIntervalMs"] = config.retryIntervalMs;
  doc["wifiReconnectIntervalMs"] = config.wifiReconnectIntervalMs;
  doc["wiegandTimeoutMs"] = config.wiegandTimeoutMs;
  doc["timeSyncTimeoutMs"] = config.timeSyncTimeoutMs;
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
