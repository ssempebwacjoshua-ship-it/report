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
  DynamicJsonDocument doc(1536);
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
    doc["deviceTime"] = event->deviceTime;
    doc["retryCount"] = event->retryCount;
    doc["syncStatus"] = event->syncStatus;
  }

  String payload;
  serializeJson(doc, payload);
  return payload;
}

bool GatewayClient::parseResponse(const String& body, int statusCode, ReaderApiResponse& response) {
  response = ReaderApiResponse{};
  response.success = statusCode >= 200 && statusCode < 300;
  response.beep = response.success ? "success" : "error";

  if (body.isEmpty()) {
    return response.success;
  }

  DynamicJsonDocument doc(768);
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
    secureClient = std::make_unique<WiFiClientSecure>();
    applyTls(*secureClient, config);
    if (!http.begin(*secureClient, url)) {
      return false;
    }
  } else {
    if (!http.begin(plainClient, url)) {
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
  http.end();

  return parseResponse(responseBody, statusCode, response);
}

bool GatewayClient::postScan(const ReaderGatewayConfig& config, const ReaderScanEvent& event, ReaderApiResponse& response) {
  const String body = buildBasePayload(config, &event, false);
  return sendJson(config, config.eventsPath, body, response);
}

bool GatewayClient::registerDevice(const ReaderGatewayConfig& config, ReaderApiResponse& response) {
  const String body = buildBasePayload(config, nullptr, true);
  return sendJson(config, config.registrationPath, body, response);
}
