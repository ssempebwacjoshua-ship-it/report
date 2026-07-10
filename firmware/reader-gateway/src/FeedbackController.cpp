#include "ssamenj/FeedbackController.h"

namespace {
void pulsePinOnce(int8_t pin, uint16_t onMs, uint16_t offMs) {
  if (pin < 0) {
    return;
  }
  digitalWrite(pin, HIGH);
  delay(onMs);
  digitalWrite(pin, LOW);
  delay(offMs);
}
}  // namespace

void FeedbackController::begin(const ReaderGatewayConfig& config) {
  buzzerPin_ = config.buzzerPin;
  ledPin_ = config.ledPin;

  if (buzzerPin_ >= 0) {
    pinMode(buzzerPin_, OUTPUT);
    digitalWrite(buzzerPin_, LOW);
  }
  if (ledPin_ >= 0) {
    pinMode(ledPin_, OUTPUT);
    digitalWrite(ledPin_, LOW);
  }
}

void FeedbackController::pulsePin(int8_t pin, uint8_t pulses, uint16_t onMs, uint16_t offMs) {
  for (uint8_t index = 0; index < pulses; ++index) {
    pulsePinOnce(pin, onMs, offMs);
  }
}

void FeedbackController::play(GatewayFeedbackTone tone) {
  switch (tone) {
    case GatewayFeedbackTone::Success:
      pulsePin(buzzerPin_, 2, 80, 60);
      pulsePin(ledPin_, 2, 80, 60);
      break;
    case GatewayFeedbackTone::Warning:
      pulsePin(buzzerPin_, 3, 50, 35);
      pulsePin(ledPin_, 3, 50, 35);
      break;
    case GatewayFeedbackTone::Error:
      pulsePin(buzzerPin_, 1, 220, 100);
      pulsePin(ledPin_, 1, 220, 100);
      break;
    case GatewayFeedbackTone::None:
    default:
      break;
  }
}
