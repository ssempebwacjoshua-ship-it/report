#pragma once

#include <Arduino.h>

#include "GatewayTypes.h"

class FeedbackController {
 public:
  void begin(const ReaderGatewayConfig& config);
  void play(GatewayFeedbackTone tone);
  void loop();
};
