#pragma once

#include <Arduino.h>

#ifndef SSAMENJ_GATEWAY_VERSION
#define SSAMENJ_GATEWAY_VERSION "1.0.0"
#endif

enum class GatewayFeedbackTone {
  None,
  Success,
  Warning,
  Error,
};

struct ReaderGatewayConfig {
  String deviceId;
  String schoolId;
  String readerId;
  String wifiSsid;
  String wifiPassword;
  String apiBaseUrl;
  String eventsPath;
  String registrationPath;
  String bearerToken;
  String firmwareVersion;
  String ntpServer;
  String otaPassword;
  String tlsRootCaPem;

  uint32_t retryIntervalMs = 10000;
  uint32_t wifiReconnectIntervalMs = 15000;
  uint32_t wiegandTimeoutMs = 30;
  uint32_t timeSyncTimeoutMs = 5000;

  int8_t d0Pin = 4;
  int8_t d1Pin = 5;
  int8_t buzzerPin = -1;
  int8_t ledPin = -1;

  bool tlsInsecure = true;
  bool autoRegister = true;
};

struct ReaderScanEvent {
  String eventId;
  String credential;
  String format;
  String deviceTime;
  String readerId;
  String schoolId;
  String deviceId;
  String firmwareVersion;
  uint32_t retryCount = 0;
  String syncStatus = "pending";
};

struct ReaderApiResponse {
  bool success = false;
  String action;
  String message;
  String studentName;
  String beep = "none";
};
