#pragma once

#include <Arduino.h>

#include "GatewayClient.h"

class DeviceRegistration {
 public:
  bool begin(GatewayClient* client, const ReaderGatewayConfig* config);
  bool shouldRegister(uint32_t nowMs) const;
  bool registerNow(ReaderRegistrationResult* result = nullptr);

 private:
  GatewayClient* client_ = nullptr;
  const ReaderGatewayConfig* config_ = nullptr;
  uint32_t lastRegistrationMs_ = 0;
  uint32_t intervalMs_ = 24UL * 60UL * 60UL * 1000UL;
};
