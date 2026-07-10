#pragma once

#include <Arduino.h>

#include "GatewayTypes.h"

class FeedbackController {
 public:
  void begin(const ReaderGatewayConfig& config);
  void play(GatewayFeedbackTone tone);

 private:
  int8_t buzzerPin_ = -1;
  int8_t ledPin_ = -1;
  void pulsePin(int8_t pin, uint8_t pulses, uint16_t onMs, uint16_t offMs);
};
