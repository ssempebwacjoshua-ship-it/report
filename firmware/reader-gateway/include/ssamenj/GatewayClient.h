#pragma once

#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

#include "GatewayTypes.h"

class GatewayClient {
 public:
  bool begin(const ReaderGatewayConfig& config);
  bool postScan(const ReaderGatewayConfig& config, const ReaderScanEvent& event, ReaderApiResponse& response);
  bool registerDevice(const ReaderGatewayConfig& config, ReaderApiResponse& response);
  bool postHeartbeat(const ReaderGatewayConfig& config, const ReaderHeartbeatMetrics& metrics, ReaderApiResponse& response);
  bool checkForOtaUpdate(const ReaderGatewayConfig& config, size_t queueDepth, ReaderOtaManifest& manifest);
  bool reportOtaStatus(const ReaderGatewayConfig& config, const ReaderOtaStatusReport& report, ReaderApiResponse& response);

 private:
  bool sendJson(const ReaderGatewayConfig& config, const String& path, const String& body, ReaderApiResponse& response);
  bool sendJsonRaw(const ReaderGatewayConfig& config, const String& path, const String& body, int& statusCode, String& responseBody);
  String buildUrl(const ReaderGatewayConfig& config, const String& path) const;
  void applyTls(WiFiClientSecure& client, const ReaderGatewayConfig& config);
  void applyRequestHeaders(HTTPClient& http, const ReaderGatewayConfig& config);
  String buildBasePayload(const ReaderGatewayConfig& config, const ReaderScanEvent* event, bool registration) const;
  String buildHeartbeatPayload(const ReaderGatewayConfig& config, const ReaderHeartbeatMetrics& metrics) const;
  bool parseResponse(const String& body, int statusCode, ReaderApiResponse& response);
};
