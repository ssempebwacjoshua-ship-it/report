#pragma once

#include <Arduino.h>

#include "FeedbackPattern.h"
#include "GatewayTypes.h"

class FeedbackController {
 public:
  void begin(const ReaderGatewayConfig& config);
  void play(GatewayFeedbackTone tone);
  void loop();

 private:
  void setBuzzer(bool active);
  void setLed(bool active);
  void resetPlayback();

  int8_t buzzerPin_ = -1;
  int8_t ledPin_ = -1;
  bool enabled_ = false;
  uint8_t activeLevel_ = HIGH;
  uint8_t idleLevel_ = LOW;
  FeedbackPattern currentPattern_ {0, 0, 0, false, 0};
  bool buzzerActive_ = false;
  bool ledActive_ = false;
  bool playing_ = false;
  bool ledLatchArmed_ = false;
  uint8_t pulsesRemaining_ = 0;
  unsigned long nextTransitionMs_ = 0;
  unsigned long ledOffAtMs_ = 0;
};
