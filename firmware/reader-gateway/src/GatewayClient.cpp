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

String GatewayClient::buildBasePayload(const ReaderGatewayConfig& config, const ReaderScanEvent* event, bool registration) const {
  JsonDocument doc;
  doc["deviceId"] = config.deviceId;
  doc["readerId"] = config.readerId;
  doc["schoolId"] = config.schoolId;
  doc["firmwareVersion"] = config.firmwareVersion;
  doc["transport"] = "esp32-wiegand";
  doc["schemaVersion"] = "1.0";

  if (registration) {
    doc["eventType"] = "device.registration";
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
  doc["queueDepth"] = static_cast<uint32_t>(metrics.queueDepth);
  if (!metrics.lastSuccessfulApiContactAt.isEmpty()) {
    doc["lastSuccessfulApiContactAt"] = metrics.lastSuccessfulApiContactAt;
  }

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

bool GatewayClient::sendJson(const ReaderGatewayConfig& config, const String& path, const String& body, ReaderApiResponse& response) {
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

  http.setTimeout(10000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", config.deviceId);
  http.addHeader("X-Reader-Id", config.readerId);
  http.addHeader("X-School-Id", config.schoolId);
  http.addHeader("X-Firmware-Version", config.firmwareVersion);
  if (!config.bearerToken.isEmpty()) {
    http.addHeader("Authorization", String("Bearer ") + config.bearerToken);
  }

  const int statusCode = http.POST(body);
  const String responseBody = http.getString();
  Serial.printf("HTTP status code: %d\n", statusCode);
  if (statusCode < 0) {
    Serial.printf("HTTP error: %s\n", HTTPClient::errorToString(statusCode).c_str());
    if (secureClient) {
      logTlsError(*secureClient);
    }
  }
  Serial.printf("API response body: %s\n", responseBody.isEmpty() ? "(empty)" : responseBody.c_str());
  http.end();

  return parseResponse(responseBody, statusCode, response);
}

bool GatewayClient::postScan(const ReaderGatewayConfig& config, const ReaderScanEvent& event, ReaderApiResponse& response) {
  const String body = buildBasePayload(config, &event, false);
  Serial.printf("Payload sent: %s\n", body.c_str());
  return sendJson(config, config.eventsPath, body, response);
}

bool GatewayClient::registerDevice(const ReaderGatewayConfig& config, ReaderApiResponse& response) {
  const String body = buildBasePayload(config, nullptr, true);
  return sendJson(config, config.registrationPath, body, response);
}

bool GatewayClient::postHeartbeat(const ReaderGatewayConfig& config, const ReaderHeartbeatMetrics& metrics, ReaderApiResponse& response) {
  const String body = buildHeartbeatPayload(config, metrics);
  return sendJson(config, config.heartbeatPath, body, response);
}
