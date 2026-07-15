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
  if (feedbackToneEqualsIgnoreCase(beep, "unknown")) {
    return GatewayFeedbackTone::Unknown;
  }
  if (feedbackToneEqualsIgnoreCase(beep, "warning") || feedbackToneEqualsIgnoreCase(beep, "out_of_session")) {
    return GatewayFeedbackTone::OutOfSession;
  }
  if (
    feedbackToneEqualsIgnoreCase(beep, "queued")
    || feedbackToneEqualsIgnoreCase(beep, "offline")
    || feedbackToneEqualsIgnoreCase(beep, "offline_queued")
  ) {
    return GatewayFeedbackTone::Queued;
  }
  if (
    feedbackToneEqualsIgnoreCase(beep, "error")
    || feedbackToneEqualsIgnoreCase(beep, "blocked")
    || feedbackToneEqualsIgnoreCase(beep, "failed")
    || feedbackToneEqualsIgnoreCase(beep, "denied")
  ) {
    return GatewayFeedbackTone::Error;
  }
  return GatewayFeedbackTone::None;
}

inline bool feedbackStatusEqualsIgnoreCase(const char* status, const char* expected) {
  return feedbackToneEqualsIgnoreCase(status, expected);
}

inline GatewayFeedbackTone feedbackToneFromResponse(const char* beep, const char* status, int statusCode, bool success) {
  if (feedbackStatusEqualsIgnoreCase(status, "UNKNOWN_CREDENTIAL")) {
    return GatewayFeedbackTone::Unknown;
  }
  if (
    feedbackStatusEqualsIgnoreCase(status, "SESSION_CLOSED")
    || feedbackStatusEqualsIgnoreCase(status, "OUT_OF_SESSION")
    || feedbackStatusEqualsIgnoreCase(status, "ATTENDANCE_CLOSED")
  ) {
    return GatewayFeedbackTone::OutOfSession;
  }
  if (feedbackStatusEqualsIgnoreCase(status, "OFFLINE_QUEUED")) {
    return GatewayFeedbackTone::Queued;
  }

  const GatewayFeedbackTone directTone = feedbackToneFromBeepValue(beep);
  if (directTone != GatewayFeedbackTone::None) {
    return directTone;
  }

  if (!success && statusCode == 404) {
    return GatewayFeedbackTone::Unknown;
  }

  return success ? GatewayFeedbackTone::Success : GatewayFeedbackTone::Error;
}

inline const char* feedbackToneName(GatewayFeedbackTone tone) {
  switch (tone) {
    case GatewayFeedbackTone::Success:
      return "success";
    case GatewayFeedbackTone::Duplicate:
      return "duplicate";
    case GatewayFeedbackTone::Unknown:
      return "unknown";
    case GatewayFeedbackTone::OutOfSession:
      return "out_of_session";
    case GatewayFeedbackTone::Queued:
      return "queued";
    case GatewayFeedbackTone::Error:
      return "error";
    case GatewayFeedbackTone::None:
    default:
      return "none";
  }
}
