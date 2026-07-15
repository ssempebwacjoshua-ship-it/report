#pragma once

#include <ctype.h>

#include "FeedbackTone.h"

inline bool feedbackToneEqualsIgnoreCase(const char* left, const char* right) {
  if (left == nullptr || right == nullptr) {
    return false;
  }
  while (*left != '\0' && *right != '\0') {
    if (tolower(static_cast<unsigned char>(*left)) != tolower(static_cast<unsigned char>(*right))) {
      return false;
    }
    left += 1;
    right += 1;
  }
  return *left == '\0' && *right == '\0';
}

inline GatewayFeedbackTone feedbackToneFromBeepValue(const char* beep) {
  if (feedbackToneEqualsIgnoreCase(beep, "success")) {
    return GatewayFeedbackTone::Success;
  }
  if (feedbackToneEqualsIgnoreCase(beep, "duplicate")) {
    return GatewayFeedbackTone::Duplicate;
  }
  if (feedbackToneEqualsIgnoreCase(beep, "warning") || feedbackToneEqualsIgnoreCase(beep, "out_of_session")) {
    return GatewayFeedbackTone::Warning;
  }
  if (
    feedbackToneEqualsIgnoreCase(beep, "offline")
    || feedbackToneEqualsIgnoreCase(beep, "offline_queued")
    || feedbackToneEqualsIgnoreCase(beep, "queued")
  ) {
    return GatewayFeedbackTone::Offline;
  }
  if (
    feedbackToneEqualsIgnoreCase(beep, "error")
    || feedbackToneEqualsIgnoreCase(beep, "unknown")
    || feedbackToneEqualsIgnoreCase(beep, "blocked")
    || feedbackToneEqualsIgnoreCase(beep, "failed")
    || feedbackToneEqualsIgnoreCase(beep, "denied")
  ) {
    return GatewayFeedbackTone::Error;
  }
  return GatewayFeedbackTone::None;
}

inline const char* feedbackToneName(GatewayFeedbackTone tone) {
  switch (tone) {
    case GatewayFeedbackTone::Success:
      return "success";
    case GatewayFeedbackTone::Duplicate:
      return "duplicate";
    case GatewayFeedbackTone::Warning:
      return "warning";
    case GatewayFeedbackTone::Offline:
      return "offline";
    case GatewayFeedbackTone::Error:
      return "error";
    case GatewayFeedbackTone::None:
    default:
      return "none";
  }
}
