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
    pinMode(buzzerPin_, OUTPUT);
    digitalWrite(buzzerPin_, idleLevel_);
  }
  if (ledPin_ >= 0) {
    pinMode(ledPin_, OUTPUT);
    digitalWrite(ledPin_, idleLevel_);
  }
  resetPlayback();
}

void FeedbackController::setBuzzer(bool active) {
  if (buzzerPin_ >= 0) {
    digitalWrite(buzzerPin_, active ? activeLevel_ : idleLevel_);
  }
  buzzerActive_ = active;
}

void FeedbackController::setLed(bool active) {
  if (ledPin_ >= 0) {
    digitalWrite(ledPin_, active ? activeLevel_ : idleLevel_);
  }
  ledActive_ = active;
}

void FeedbackController::resetPlayback() {
  setBuzzer(false);
  setLed(false);
  playing_ = false;
  ledLatchArmed_ = false;
  pulsesRemaining_ = 0;
  nextTransitionMs_ = 0;
  ledOffAtMs_ = 0;
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
    case GatewayFeedbackTone::NetworkFailure:
      Serial.println("Feedback: network-failure");
      break;
    case GatewayFeedbackTone::None:
    default:
      return;
  }

  if (!enabled_) {
    return;
  }

  currentPattern_ = feedbackPatternForTone(tone);
  const unsigned long now = millis();
  playing_ = currentPattern_.buzzerPulses > 0;
  pulsesRemaining_ = currentPattern_.buzzerPulses;
  ledLatchArmed_ = currentPattern_.ledEnabled && currentPattern_.ledOnMs > 0;
  ledOffAtMs_ = ledLatchArmed_ ? now + currentPattern_.ledOnMs : 0;

  if (currentPattern_.ledEnabled && ledPin_ >= 0) {
    setLed(true);
  } else {
    setLed(false);
  }

  if (playing_ && buzzerPin_ >= 0) {
    setBuzzer(true);
    nextTransitionMs_ = now + currentPattern_.buzzerOnMs;
  } else {
    setBuzzer(false);
    nextTransitionMs_ = 0;
  }
}

void FeedbackController::loop() {
  if (!enabled_) {
    return;
  }

  const unsigned long now = millis();

  if (ledLatchArmed_ && ledActive_ && now >= ledOffAtMs_) {
    setLed(false);
    ledLatchArmed_ = false;
  }

  if (!playing_) {
    return;
  }

  if (now < nextTransitionMs_) {
    return;
  }

  if (buzzerActive_) {
    setBuzzer(false);
    if (pulsesRemaining_ > 0) {
      pulsesRemaining_ -= 1;
    }
    if (pulsesRemaining_ == 0) {
      playing_ = false;
      nextTransitionMs_ = 0;
      return;
    }
    nextTransitionMs_ = now + currentPattern_.buzzerOffMs;
    return;
  }

  setBuzzer(true);
  nextTransitionMs_ = now + currentPattern_.buzzerOnMs;
}
