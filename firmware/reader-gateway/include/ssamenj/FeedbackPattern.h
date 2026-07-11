#pragma once

#include <stdint.h>

#include "FeedbackTone.h"

struct FeedbackPattern {
  uint8_t pulses;
  uint16_t onMs;
  uint16_t offMs;
};

inline FeedbackPattern feedbackPatternForTone(GatewayFeedbackTone tone) {
  switch (tone) {
    case GatewayFeedbackTone::Success:
      return {1, 100, 0};
    case GatewayFeedbackTone::Duplicate:
      return {2, 100, 100};
    case GatewayFeedbackTone::Error:
      return {1, 600, 0};
    case GatewayFeedbackTone::Offline:
      return {3, 100, 100};
    case GatewayFeedbackTone::None:
    default:
      return {0, 0, 0};
  }
}
