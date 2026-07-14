#include "ssamenj/DeviceRegistration.h"

bool DeviceRegistration::begin(GatewayClient* client, const ReaderGatewayConfig* config) {
  client_ = client;
  config_ = config;
  lastRegistrationMs_ = 0;
  intervalMs_ = 24UL * 60UL * 60UL * 1000UL;
  return client_ != nullptr && config_ != nullptr;
}

bool DeviceRegistration::shouldRegister(uint32_t nowMs) const {
  return client_ != nullptr && config_ != nullptr && config_->autoRegister && (lastRegistrationMs_ == 0 || nowMs - lastRegistrationMs_ >= intervalMs_);
}

bool DeviceRegistration::registerNow(ReaderRegistrationResult* result) {
  if (client_ == nullptr || config_ == nullptr || !config_->autoRegister) {
    return false;
  }

  lastRegistrationMs_ = millis();
  ReaderApiResponse response;
  ReaderRegistrationResult parsed;
  const bool ok = client_->registerDevice(*config_, response, parsed) && response.success;
  if (result != nullptr) {
    *result = parsed;
  }
  return ok;
}
