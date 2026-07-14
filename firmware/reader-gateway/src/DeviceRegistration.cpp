#include "ssamenj/DeviceRegistration.h"

bool DeviceRegistration::begin(GatewayClient* client, const ReaderGatewayConfig* config) {
  client_ = client;
  config_ = config;
  lastRegistrationMs_ = 0;
  lastRegistrationSucceeded_ = false;
  intervalMs_ = 24UL * 60UL * 60UL * 1000UL;
  return client_ != nullptr && config_ != nullptr;
}

bool DeviceRegistration::shouldRegister(uint32_t nowMs) const {
  if (client_ == nullptr || config_ == nullptr || !config_->autoRegister) {
    return false;
  }

  const bool assigned = !config_->schoolId.isEmpty() && !config_->bearerToken.isEmpty()
    && config_->bearerToken != SSAMENJ_GATEWAY_DEFAULT_PROVISIONING_TOKEN;
  const uint32_t dueIntervalMs = assigned && lastRegistrationSucceeded_
    ? intervalMs_
    : 30UL * 1000UL;
  return lastRegistrationMs_ == 0 || nowMs - lastRegistrationMs_ >= dueIntervalMs;
}

bool DeviceRegistration::registerNow(ReaderRegistrationResult* result) {
  if (client_ == nullptr || config_ == nullptr || !config_->autoRegister) {
    return false;
  }

  lastRegistrationMs_ = millis();
  ReaderApiResponse response;
  ReaderRegistrationResult parsed;
  const bool ok = client_->registerDevice(*config_, response, parsed) && response.success;
  lastRegistrationSucceeded_ = ok;
  if (result != nullptr) {
    *result = parsed;
  }
  return ok;
}
