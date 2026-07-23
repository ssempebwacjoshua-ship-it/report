#pragma once

#include <Arduino.h>

#include "FeedbackTone.h"

#ifndef SSAMENJ_GATEWAY_VERSION
#define SSAMENJ_GATEWAY_VERSION "1.0.0"
#endif

#ifndef SSAMENJ_GATEWAY_DEFAULT_API_BASE_URL
#define SSAMENJ_GATEWAY_DEFAULT_API_BASE_URL "https://school-connect.example.com"
#endif

#ifndef SSAMENJ_GATEWAY_DEFAULT_PROVISIONING_TOKEN
#define SSAMENJ_GATEWAY_DEFAULT_PROVISIONING_TOKEN ""
#endif

#ifndef SSAMENJ_GATEWAY_DEFAULT_FIRMWARE_CHANNEL
#define SSAMENJ_GATEWAY_DEFAULT_FIRMWARE_CHANNEL "stable"
#endif

#ifndef SSAMENJ_GATEWAY_DEFAULT_DEVICE_ID
#define SSAMENJ_GATEWAY_DEFAULT_DEVICE_ID ""
#endif
#ifndef SSAMENJ_GATEWAY_DEFAULT_READER_ID
#define SSAMENJ_GATEWAY_DEFAULT_READER_ID ""
#endif
#ifndef SSAMENJ_GATEWAY_DEFAULT_SCHOOL_ID
#define SSAMENJ_GATEWAY_DEFAULT_SCHOOL_ID ""
#endif
#ifndef SSAMENJ_GATEWAY_DEFAULT_DEVICE_NAME
#define SSAMENJ_GATEWAY_DEFAULT_DEVICE_NAME ""
#endif
#ifndef SSAMENJ_GATEWAY_DEFAULT_READER_LOCATION
#define SSAMENJ_GATEWAY_DEFAULT_READER_LOCATION ""
#endif
#ifndef SSAMENJ_GATEWAY_DEFAULT_READER_TYPE
#define SSAMENJ_GATEWAY_DEFAULT_READER_TYPE ""
#endif
#ifndef SSAMENJ_GATEWAY_DEFAULT_DEVICE_TOKEN
#define SSAMENJ_GATEWAY_DEFAULT_DEVICE_TOKEN ""
#endif

struct ReaderGatewayConfig {
  String deviceId;
  String schoolId;
  String readerId;
  String deviceName;
  String readerLocation;
  String readerType;
  String activationCode;
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

struct ReaderRegistrationResult {
  bool success = false;
  String assignmentStatus;
  String schoolId;
  String schoolName;
  String deviceId;
  String readerId;
  String bearerToken;
  String apiBaseUrl;
  String firmwareChannel;
  String deviceName;
  String readerLocation;
  String readerType;
  String message;
};

struct ReaderHeartbeatMetrics {
  int32_t wifiRssi = 0;
  String localIp;
  uint32_t uptimeMs = 0;
  uint32_t freeHeap = 0;
  String rebootReason;
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
