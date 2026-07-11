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
  bool enabled_ = false;
  uint8_t activeLevel_ = HIGH;
  uint8_t idleLevel_ = LOW;
  void setOutputs(uint8_t level);
};
