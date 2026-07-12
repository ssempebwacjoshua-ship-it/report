#pragma once

#include <Arduino.h>

#include "FeedbackTone.h"

#ifndef SSAMENJ_GATEWAY_VERSION
#define SSAMENJ_GATEWAY_VERSION "1.0.0"
#endif

struct ReaderGatewayConfig {
  String deviceId;
  String schoolId;
  String readerId;
  String firmwareChannel;
  String wifiSsid;
  String wifiPassword;
  String apiBaseUrl;
  String eventsPath;
  String registrationPath;
  String heartbeatPath;
  String otaCheckPath;
  String otaStatusPath;
  String bearerToken;
  String firmwareVersion;
  String ntpServer;
  String otaPublicKeyPem;
  String otaPublicKeyId;
  String tlsRootCaPem;

  uint32_t retryIntervalMs = 10000;
  uint32_t wifiReconnectIntervalMs = 15000;
  uint32_t wiegandTimeoutMs = 30;
  uint32_t timeSyncTimeoutMs = 5000;
  uint32_t otaCheckIntervalMs = 3600000;

  int8_t d0Pin = 18;
  int8_t d1Pin = 19;
  int8_t buzzerPin = -1;
  int8_t ledPin = -1;

  bool tlsInsecure = true;
  bool autoRegister = true;
  bool feedbackOutputsEnabled = false;
  bool feedbackDriverActiveHigh = false;
};

struct ReaderScanEvent {
  String eventId;
  String credential;
  String format;
  String rawWiegandBinary;
  String rawWiegandDecimal;
  String rawWiegandHex;
  String facilityCode;
  String cardNumber;
  String deviceTime;
  String readerId;
  String schoolId;
  String deviceId;
  String firmwareVersion;
  uint8_t rawWiegandBitCount = 0;
  uint32_t retryCount = 0;
  String syncStatus = "pending";
};

struct ReaderApiResponse {
  bool success = false;
  int statusCode = 0;
  String action;
  String message;
  String studentName;
  String beep = "none";
};

struct ReaderHeartbeatMetrics {
  int32_t wifiRssi = 0;
  String localIp;
  uint32_t uptimeMs = 0;
  uint32_t freeHeap = 0;
  size_t queueDepth = 0;
  String lastSuccessfulApiContactAt;
};

struct ReaderOtaManifest {
  bool updateAvailable = false;
  String releaseId;
  String version;
  String channel;
  String downloadPath;
  String downloadUrl;
  String sha256;
  String signature;
  String signatureAlgorithm;
  String publicKeyId;
  uint32_t sizeBytes = 0;
};

struct ReaderOtaStatusReport {
  String releaseId;
  String fromVersion;
  String toVersion;
  String status;
  String message;
};
