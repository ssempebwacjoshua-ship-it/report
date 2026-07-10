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

 private:
  bool sendJson(const ReaderGatewayConfig& config, const String& path, const String& body, ReaderApiResponse& response);
  String buildUrl(const ReaderGatewayConfig& config, const String& path) const;
  void applyTls(WiFiClientSecure& client, const ReaderGatewayConfig& config);
  String buildBasePayload(const ReaderGatewayConfig& config, const ReaderScanEvent* event, bool registration) const;
  bool parseResponse(const String& body, int statusCode, ReaderApiResponse& response);
};
