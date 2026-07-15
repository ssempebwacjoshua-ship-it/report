#pragma once

#include <stdint.h>

#include "FeedbackTone.h"

struct FeedbackPattern {
  uint8_t buzzerPulses;
  uint16_t firstBuzzerOnMs;
  uint16_t repeatingBuzzerOnMs;
  uint16_t buzzerOffMs;
  bool ledEnabled;
  uint16_t ledOnMs;
};

inline FeedbackPattern feedbackPatternForTone(GatewayFeedbackTone tone) {
  switch (tone) {
    case GatewayFeedbackTone::Success:
      return {1, 120, 120, 0, true, 800};
    case GatewayFeedbackTone::Duplicate:
      return {2, 100, 100, 90, false, 0};
    case GatewayFeedbackTone::Warning:
      return {1, 420, 420, 0, false, 0};
    case GatewayFeedbackTone::Offline:
      return {2, 100, 320, 120, false, 0};
    case GatewayFeedbackTone::Error:
      return {1, 420, 420, 0, false, 0};
    case GatewayFeedbackTone::None:
    default:
      return {0, 0, 0, 0, false, 0};
  }
}
