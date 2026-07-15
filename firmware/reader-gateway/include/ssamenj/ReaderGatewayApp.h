#pragma once

#include <Arduino.h>
#include <Preferences.h>
#include <Ticker.h>

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
  bool consumeFactoryResetFlag();
  bool checkRollbackState();
  bool loadPendingOtaManifest(ReaderOtaManifest& manifest) const;
  bool savePendingOtaManifest(const ReaderOtaManifest& manifest) const;
  void clearPendingOtaManifest() const;
  bool shouldDeferOtaUpdate() const;
  bool verifyDownloadedFirmware(const String& digestHex, const ReaderOtaManifest& manifest) const;
  bool installOtaUpdate(const ReaderOtaManifest& manifest);
  void maybeCheckForOtaUpdate();
  void maybeConfirmOtaBoot();
  void reportOtaStatus(const String& status, const String& message, const ReaderOtaManifest& manifest);
  bool beginProvisioningStorage();
  void loadProvisioningState();
  void applyProvisioningOverrides();
  bool migrateHardwareFeedbackConfig();
  bool normalizeRegistrationMode();
  bool persistAssignedConfiguration();
  void applyRegistrationResult(const ReaderRegistrationResult& result);
  bool hasStoredWifiCredentials() const;
  String configuredWifiSsid() const;
  String configuredWifiPassword() const;
  String setupAccessPointSsid() const;
  bool openSetupPortal(const char* reason);
  void clearStoredWifiCredentials();
  void updateOfflinePortalFallback();
  void handleFactoryResetButton();
  void startSetupLedBlink();
  void stopSetupLedBlink();
  void toggleSetupLed();
  static void toggleSetupLedTick(ReaderGatewayApp* app);
  bool isValidScanEvent(const ReaderScanEvent& event, const char*& reason) const;
  unsigned long retryDelayFor(const ReaderScanEvent& event) const;
  void ensureWiFi();
  void syncClock();
  void processScan(const ReaderScanEvent& event);
  void processOfflineQueue();
  void sendHeartbeat();
  void maybeProcessPendingCommand(const ReaderApiResponse& response);
  bool installCommandOtaUpdate(const ReaderApiResponse::ReaderPendingCommand& command);
  void reportCommandStatus(const String& commandId, const String& status, const String& message, const String& firmwareVersion = "");
  void markApiContact();
  bool hasWorkingNetwork() const;
  bool shouldSuppressDuplicateScan(const ReaderScanEvent& event) const;
  void rememberAcceptedScan(const ReaderScanEvent& event);
  String utcIso8601Now() const;
  String createEventId() const;

  ConfigManager configManager_;
  OfflineQueue offlineQueue_;
  GatewayClient gatewayClient_;
  FeedbackController feedback_;
  WiegandReader wiegand_;
  DeviceRegistration deviceRegistration_;
  Preferences provisioningPreferences_;
  ReaderGatewayConfig config_;
  bool clockSynced_ = false;
  bool transactionActive_ = false;
  bool otaUpdateInProgress_ = false;
  bool otaPendingRollbackConfirm_ = false;
  bool provisioningStorageReady_ = false;
  bool setupRequired_ = false;
  bool setupLedState_ = false;
  ReaderOtaManifest pendingOtaManifest_;
  unsigned long lastWifiAttemptMs_ = 0;
  unsigned long lastQueueAttemptMs_ = 0;
  unsigned long lastHeartbeatMs_ = 0;
  unsigned long lastOtaCheckMs_ = 0;
  unsigned long wifiDisconnectedSinceMs_ = 0;
  unsigned long bootButtonPressedAtMs_ = 0;
  String lastSuccessfulApiContactAt_;
  String provisionedWifiSsid_;
  String provisionedWifiPassword_;
  String provisionedActivationCode_;
  String provisionedFirmwareChannel_;
  bool wifiConnectedLogged_ = false;
  String lastAcceptedCredential_;
  String lastAcceptedReaderId_;
  unsigned long lastAcceptedScanAtMs_ = 0;
  size_t offlineQueueDepth_ = 0;
  Ticker setupLedTicker_;
};
