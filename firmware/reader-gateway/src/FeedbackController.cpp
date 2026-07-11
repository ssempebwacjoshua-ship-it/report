#include "ssamenj/FeedbackController.h"
#include "ssamenj/FeedbackPattern.h"

void FeedbackController::begin(const ReaderGatewayConfig& config) {
  buzzerPin_ = config.buzzerPin;
  ledPin_ = config.ledPin;
  enabled_ = config.feedbackOutputsEnabled && (buzzerPin_ >= 0 || ledPin_ >= 0);
  activeLevel_ = config.feedbackDriverActiveHigh ? HIGH : LOW;
  idleLevel_ = config.feedbackDriverActiveHigh ? LOW : HIGH;

  if (!enabled_) {
    Serial.println("Feedback outputs disabled; control wires must remain disconnected");
    return;
  }

  if (buzzerPin_ >= 0) {
    digitalWrite(buzzerPin_, idleLevel_);
    pinMode(buzzerPin_, OUTPUT);
  }
  if (ledPin_ >= 0) {
    digitalWrite(ledPin_, idleLevel_);
    pinMode(ledPin_, OUTPUT);
  }
}

void FeedbackController::setOutputs(uint8_t level) {
  if (buzzerPin_ >= 0) {
    digitalWrite(buzzerPin_, level);
  }
  if (ledPin_ >= 0) {
    digitalWrite(ledPin_, level);
  }
}

void FeedbackController::play(GatewayFeedbackTone tone) {
  switch (tone) {
    case GatewayFeedbackTone::Success:
      Serial.println("Feedback: success");
      break;
    case GatewayFeedbackTone::Duplicate:
      Serial.println("Feedback: duplicate");
      break;
    case GatewayFeedbackTone::Error:
      Serial.println("Feedback: error");
      break;
    case GatewayFeedbackTone::Offline:
      Serial.println("Feedback: offline");
      break;
    case GatewayFeedbackTone::None:
    default:
      return;
  }

  if (!enabled_) {
    return;
  }

  const FeedbackPattern pattern = feedbackPatternForTone(tone);
  for (uint8_t index = 0; index < pattern.pulses; ++index) {
    setOutputs(activeLevel_);
    delay(pattern.onMs);
    setOutputs(idleLevel_);
    if (pattern.offMs > 0 && index + 1 < pattern.pulses) {
      delay(pattern.offMs);
    }
  }
}
