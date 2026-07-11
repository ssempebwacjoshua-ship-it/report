#pragma once

#include <Arduino.h>

#include "ConfigManager.h"
#include "DeviceRegistration.h"
#include "FeedbackController.h"
#include "GatewayClient.h"
#include "OfflineQueue.h"
#include "WiegandReader.h"

class ReaderGatewayApp {
 public:
  bool begin();
  void loop();

 private:
  void ensureWiFi();
  void syncClock();
  void ensureOta();
  void processScan(const ReaderScanEvent& event);
  void processOfflineQueue();
  void sendHeartbeat();
  void markApiContact();
  bool hasWorkingNetwork() const;
  String utcIso8601Now() const;
  String createEventId() const;

  ConfigManager configManager_;
  OfflineQueue offlineQueue_;
  GatewayClient gatewayClient_;
  FeedbackController feedback_;
  WiegandReader wiegand_;
  DeviceRegistration deviceRegistration_;
  ReaderGatewayConfig config_;
  bool clockSynced_ = false;
  bool otaStarted_ = false;
  unsigned long lastWifiAttemptMs_ = 0;
  unsigned long lastQueueAttemptMs_ = 0;
  unsigned long lastHeartbeatMs_ = 0;
  String lastSuccessfulApiContactAt_;
  bool wifiConnectedLogged_ = false;
};
