#include "ssamenj/GatewayClient.h"

#include <ArduinoJson.h>
#include <WiFi.h>
#include <memory>

namespace {
String joinPath(const String& base, const String& path) {
  if (base.endsWith("/") && path.startsWith("/")) {
    return base.substring(0, base.length() - 1) + path;
  }
  if (!base.endsWith("/") && !path.startsWith("/")) {
    return base + "/" + path;
  }
  return base + path;
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

bool GatewayClient::begin(const ReaderGatewayConfig& config) {
  (void)config;
  return true;
}

String GatewayClient::buildUrl(const ReaderGatewayConfig& config, const String& path) const {
  return joinPath(config.apiBaseUrl, path);
}

void GatewayClient::applyTls(WiFiClientSecure& client, const ReaderGatewayConfig& config) {
  if (!config.tlsRootCaPem.isEmpty()) {
    client.setCACert(config.tlsRootCaPem.c_str());
    return;
  }
  if (config.tlsInsecure) {
    client.setInsecure();
  }
}

void GatewayClient::applyRequestHeaders(HTTPClient& http, const ReaderGatewayConfig& config) {
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", config.deviceId);
  http.addHeader("X-Reader-Id", config.readerId);
  http.addHeader("X-School-Id", config.schoolId);
  http.addHeader("X-Firmware-Version", config.firmwareVersion);
  http.addHeader("X-Firmware-Channel", config.firmwareChannel);
  if (!config.bearerToken.isEmpty()) {
    http.addHeader("Authorization", String("Bearer ") + config.bearerToken);
  }
}

String GatewayClient::buildBasePayload(const ReaderGatewayConfig& config, const ReaderScanEvent* event, bool registration) const {
  JsonDocument doc;
  doc["deviceId"] = config.deviceId;
  doc["readerId"] = config.readerId;
  if (!config.schoolId.isEmpty()) {
    doc["schoolId"] = config.schoolId;
  }
  doc["firmwareVersion"] = config.firmwareVersion;
  doc["firmwareChannel"] = config.firmwareChannel;
  doc["transport"] = "esp32-wiegand";
  doc["schemaVersion"] = "1.0";

  if (registration) {
    doc["eventType"] = "device.registration";
    doc["activationCode"] = config.activationCode;
    doc["hardwareId"] = config.deviceId;
    doc["hardware"] = "ESP32";
    doc["deviceName"] = config.deviceName;
    doc["location"] = config.readerLocation;
    doc["readerType"] = config.readerType;
  } else if (event != nullptr) {
    doc["eventId"] = event->eventId;
    doc["credential"] = event->credential;
    doc["format"] = event->format;
    doc["rawWiegandBitCount"] = event->rawWiegandBitCount;
    doc["rawWiegandBinary"] = event->rawWiegandBinary;
    doc["rawWiegandDecimal"] = event->rawWiegandDecimal;
    doc["rawWiegandHex"] = event->rawWiegandHex;
    if (!event->facilityCode.isEmpty()) {
      doc["facilityCode"] = event->facilityCode;
    }
    if (!event->cardNumber.isEmpty()) {
      doc["cardNumber"] = event->cardNumber;
    }
    doc["deviceTime"] = event->deviceTime;
    doc["retryCount"] = event->retryCount;
    doc["syncStatus"] = event->syncStatus;
  }

  String payload;
  serializeJson(doc, payload);
  return payload;
}

String GatewayClient::buildHeartbeatPayload(const ReaderGatewayConfig& config, const ReaderHeartbeatMetrics& metrics) const {
  JsonDocument doc;
  doc["deviceId"] = config.deviceId;
  doc["readerId"] = config.readerId;
  doc["schoolId"] = config.schoolId;
  doc["firmwareVersion"] = config.firmwareVersion;
  doc["wifiRssi"] = metrics.wifiRssi;
  doc["localIp"] = metrics.localIp;
  doc["uptimeMs"] = metrics.uptimeMs;
  doc["freeHeap"] = metrics.freeHeap;
  if (!metrics.rebootReason.isEmpty()) {
    doc["rebootReason"] = metrics.rebootReason;
  }
  doc["queueDepth"] = static_cast<uint32_t>(metrics.queueDepth);
  if (!metrics.lastSuccessfulApiContactAt.isEmpty()) {
    doc["lastSuccessfulApiContactAt"] = metrics.lastSuccessfulApiContactAt;
  }

  String payload;
  serializeJson(doc, payload);
  return payload;
}

String buildOtaCheckPayload(const ReaderGatewayConfig& config, size_t queueDepth) {
  JsonDocument doc;
  doc["deviceId"] = config.deviceId;
  doc["readerId"] = config.readerId;
  doc["schoolId"] = config.schoolId;
  doc["firmwareVersion"] = config.firmwareVersion;
  doc["firmwareChannel"] = config.firmwareChannel;
  doc["queueDepth"] = static_cast<uint32_t>(queueDepth);

  String payload;
  serializeJson(doc, payload);
  return payload;
}

String buildOtaStatusPayload(const ReaderGatewayConfig& config, const ReaderOtaStatusReport& report) {
  JsonDocument doc;
  doc["deviceId"] = config.deviceId;
  doc["readerId"] = config.readerId;
  doc["schoolId"] = config.schoolId;
  doc["firmwareVersion"] = config.firmwareVersion;
  doc["firmwareChannel"] = config.firmwareChannel;
  doc["releaseId"] = report.releaseId;
  doc["fromVersion"] = report.fromVersion;
  doc["toVersion"] = report.toVersion;
  doc["status"] = report.status;
  doc["message"] = report.message;

  String payload;
  serializeJson(doc, payload);
  return payload;
}

bool GatewayClient::parseResponse(const String& body, int statusCode, ReaderApiResponse& response) {
  response = ReaderApiResponse{};
  response.statusCode = statusCode;
  response.success = statusCode >= 200 && statusCode < 300;
  response.beep = response.success ? "success" : "error";

  if (body.isEmpty()) {
    return response.success;
  }

  JsonDocument doc;
  const DeserializationError error = deserializeJson(doc, body);
  if (error) {
    return response.success;
  }

  response.success = doc["success"] | response.success;
  response.action = doc["action"] | "";
  response.message = doc["message"] | "";
  response.studentName = doc["studentName"] | "";
  response.beep = doc["beep"] | response.beep;
  return response.success;
}

bool isValidActivationPayload(const ReaderRegistrationResult& result) {
  return !result.schoolId.isEmpty()
    && !result.deviceId.isEmpty()
    && !result.readerId.isEmpty()
    && !result.bearerToken.isEmpty()
    && !result.apiBaseUrl.isEmpty()
    && !result.assignmentStatus.isEmpty();
}

bool GatewayClient::sendJson(const ReaderGatewayConfig& config, const String& path, const String& body, ReaderApiResponse& response) {
  int statusCode = 0;
  String responseBody;
  if (!sendJsonRaw(config, path, body, statusCode, responseBody)) {
    response.statusCode = statusCode;
    return false;
  }
  return parseResponse(responseBody, statusCode, response);
}

bool GatewayClient::sendJsonRaw(const ReaderGatewayConfig& config, const String& path, const String& body, int& statusCode, String& responseBody) {
  const String url = buildUrl(config, path);
  HTTPClient http;

  std::unique_ptr<WiFiClientSecure> secureClient;
  WiFiClient plainClient;
  if (url.startsWith("https://")) {
    secureClient.reset(new WiFiClientSecure());
    applyTls(*secureClient, config);
    if (!http.begin(*secureClient, url)) {
      Serial.printf("HTTP begin failed for %s\n", url.c_str());
      logTlsError(*secureClient);
      return false;
    }
  } else {
    if (!http.begin(plainClient, url)) {
      Serial.printf("HTTP begin failed for %s\n", url.c_str());
      return false;
    }
  }

  Serial.printf("HTTP POST path=%s url=%s\n", path.c_str(), url.c_str());
  http.setTimeout(10000);
  applyRequestHeaders(http, config);

  statusCode = http.POST(body);
  responseBody = http.getString();
  Serial.printf("HTTP status code: %d\n", statusCode);
  if (statusCode >= 400) {
    Serial.printf("HTTP failure path=%s body=%s\n", path.c_str(), responseBody.isEmpty() ? "(empty)" : responseBody.c_str());
  }
  if (statusCode < 0) {
    Serial.printf("HTTP error: %s\n", HTTPClient::errorToString(statusCode).c_str());
    if (secureClient) {
      logTlsError(*secureClient);
    }
  }
  http.end();

  return statusCode >= 0;
}

bool GatewayClient::postScan(const ReaderGatewayConfig& config, const ReaderScanEvent& event, ReaderApiResponse& response) {
  const String body = buildBasePayload(config, &event, false);
  Serial.printf("Payload sent: %s\n", body.c_str());
  return sendJson(config, config.eventsPath, body, response);
}

bool GatewayClient::registerDevice(const ReaderGatewayConfig& config, ReaderApiResponse& response, ReaderRegistrationResult& result) {
  result = ReaderRegistrationResult{};
  const String body = buildBasePayload(config, nullptr, true);
  int statusCode = 0;
  String responseBody;
  if (!sendJsonRaw(config, config.registrationPath, body, statusCode, responseBody)) {
    response.statusCode = statusCode;
    return false;
  }
  const bool ok = parseResponse(responseBody, statusCode, response);

  JsonDocument doc;
  if (deserializeJson(doc, responseBody) == DeserializationError::Ok) {
    result.success = doc["success"] | ok;
    result.assignmentStatus = doc["assignmentStatus"] | "";
    result.schoolId = doc["schoolId"] | "";
    result.schoolName = doc["schoolName"] | "";
    result.deviceId = doc["deviceId"] | "";
    result.readerId = doc["readerId"] | "";
    result.bearerToken = doc["bearerToken"] | "";
    result.apiBaseUrl = doc["apiBaseUrl"] | "";
    result.firmwareChannel = doc["firmwareChannel"] | "";
    result.deviceName = doc["deviceName"] | "";
    result.readerLocation = doc["location"] | "";
    result.readerType = doc["readerType"] | "";
    result.message = doc["message"] | "";
  }

  if (config.registrationPath.endsWith("/activate")) {
    bool activationPayloadValid = isValidActivationPayload(result);
    if (!activationPayloadValid) {
      response.success = false;
      response.statusCode = statusCode >= 400 ? statusCode : 502;
      response.action = "REGISTER";
      response.message = "Activation response was invalid.";
      response.beep = "error";
      result.success = false;
      return false;
    }
  }

  return ok && result.success;
}

bool GatewayClient::postHeartbeat(const ReaderGatewayConfig& config, const ReaderHeartbeatMetrics& metrics, ReaderApiResponse& response) {
  const String body = buildHeartbeatPayload(config, metrics);
  return sendJson(config, config.heartbeatPath, body, response);
}

bool GatewayClient::checkForOtaUpdate(const ReaderGatewayConfig& config, size_t queueDepth, ReaderOtaManifest& manifest) {
  manifest = ReaderOtaManifest{};
  if (config.otaCheckPath.isEmpty()) {
    return false;
  }

  const String body = buildOtaCheckPayload(config, queueDepth);
  int statusCode = 0;
  String responseBody;
  if (!sendJsonRaw(config, config.otaCheckPath, body, statusCode, responseBody)) {
    return false;
  }
  if (statusCode < 200 || statusCode >= 300) {
    return false;
  }

  JsonDocument doc;
  const DeserializationError error = deserializeJson(doc, responseBody);
  if (error) {
    return false;
  }

  manifest.updateAvailable = doc["updateAvailable"] | false;
  if (!manifest.updateAvailable) {
    return true;
  }
  manifest.releaseId = doc["releaseId"] | "";
  manifest.version = doc["version"] | "";
  manifest.channel = doc["channel"] | "";
  manifest.downloadPath = doc["downloadPath"] | "";
  manifest.downloadUrl = doc["downloadUrl"] | "";
  manifest.sha256 = doc["sha256"] | "";
  manifest.signature = doc["signature"] | "";
  manifest.signatureAlgorithm = doc["signatureAlgorithm"] | "";
  manifest.publicKeyId = doc["publicKeyId"] | "";
  manifest.sizeBytes = doc["sizeBytes"] | 0UL;
  return !manifest.releaseId.isEmpty() && !manifest.version.isEmpty() && !manifest.sha256.isEmpty() && !manifest.signature.isEmpty()
    && (!manifest.downloadPath.isEmpty() || !manifest.downloadUrl.isEmpty());
}

bool GatewayClient::reportOtaStatus(const ReaderGatewayConfig& config, const ReaderOtaStatusReport& report, ReaderApiResponse& response) {
  if (config.otaStatusPath.isEmpty()) {
    return false;
  }
  const String body = buildOtaStatusPayload(config, report);
  return sendJson(config, config.otaStatusPath, body, response);
}
