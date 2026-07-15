#include "ssamenj/FeedbackController.h"
#include "ssamenj/BeepToneMapping.h"
#include "ssamenj/FeedbackPattern.h"

void FeedbackController::begin(const ReaderGatewayConfig& config) {
  buzzerPin_ = config.buzzerPin;
  ledPin_ = config.ledPin;
  enabled_ = config.feedbackOutputsEnabled && (buzzerPin_ >= 0 || ledPin_ >= 0);
  openDrainOutputs_ = !config.feedbackDriverActiveHigh;
  activeLevel_ = config.feedbackDriverActiveHigh ? HIGH : LOW;
  idleLevel_ = config.feedbackDriverActiveHigh ? LOW : HIGH;
  Serial.printf(
    "Feedback config: buzzerPin=%d ledPin=%d feedbackDriverActiveHigh=%s activeLevel=%s idleLevel=%s enabled=%s openDrain=%s\n",
    static_cast<int>(buzzerPin_),
    static_cast<int>(ledPin_),
    config.feedbackDriverActiveHigh ? "true" : "false",
    activeLevel_ == HIGH ? "HIGH" : "LOW",
    idleLevel_ == HIGH ? "HIGH" : "LOW",
    enabled_ ? "true" : "false",
    openDrainOutputs_ ? "true" : "false"
  );

  if (!enabled_) {
    Serial.printf(
      "Feedback outputs disabled; built-in reader beep will remain generic (buzzerPin=%d ledPin=%d enabled=%s)\n",
      static_cast<int>(buzzerPin_),
      static_cast<int>(ledPin_),
      config.feedbackOutputsEnabled ? "true" : "false"
    );
    return;
  }

  if (buzzerPin_ >= 0) {
    pinMode(buzzerPin_, openDrainOutputs_ ? OUTPUT_OPEN_DRAIN : OUTPUT);
    digitalWrite(buzzerPin_, idleLevel_);
    Serial.printf(
      "Feedback init: buzzerPin=%d idle %s initialized mode=%s\n",
      static_cast<int>(buzzerPin_),
      idleLevel_ == HIGH ? "HIGH" : "LOW",
      openDrainOutputs_ ? "OUTPUT_OPEN_DRAIN" : "OUTPUT"
    );
  }
  if (ledPin_ >= 0) {
    pinMode(ledPin_, openDrainOutputs_ ? OUTPUT_OPEN_DRAIN : OUTPUT);
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
  pulsesPlayed_ = 0;
  nextTransitionMs_ = 0;
  ledOffAtMs_ = 0;
}

void FeedbackController::play(GatewayFeedbackTone tone) {
  const char* toneLabel = nullptr;
  switch (tone) {
    case GatewayFeedbackTone::Success:
      toneLabel = "success";
      break;
    case GatewayFeedbackTone::Duplicate:
      toneLabel = "duplicate";
      break;
    case GatewayFeedbackTone::Unknown:
      toneLabel = "unknown";
      break;
    case GatewayFeedbackTone::OutOfSession:
      toneLabel = "out_of_session";
      break;
    case GatewayFeedbackTone::Queued:
      toneLabel = "queued";
      break;
    case GatewayFeedbackTone::Error:
      toneLabel = "error";
      break;
    case GatewayFeedbackTone::None:
    default:
      return;
  }

  Serial.printf("Feedback: %s\n", toneLabel);

  if (!enabled_) {
    Serial.printf("Feedback tone '%s' requested but GPIO feedback is disabled; no ESP32 buzzer pattern will play\n", toneLabel);
    return;
  }

  currentPattern_ = feedbackPatternForTone(tone);
  const unsigned long now = millis();
  playing_ = currentPattern_.buzzerPulses > 0;
  pulsesRemaining_ = currentPattern_.buzzerPulses;
  pulsesPlayed_ = 0;
  ledLatchArmed_ = currentPattern_.ledEnabled && currentPattern_.ledOnMs > 0;
  ledOffAtMs_ = ledLatchArmed_ ? now + currentPattern_.ledOnMs : 0;

  if (currentPattern_.ledEnabled && ledPin_ >= 0) {
    setLed(true);
  } else {
    setLed(false);
  }

  if (playing_ && buzzerPin_ >= 0) {
    setBuzzer(true);
    nextTransitionMs_ = now + currentPattern_.firstBuzzerOnMs;
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
      pulsesPlayed_ += 1;
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
  const uint16_t pulseOnMs = pulsesPlayed_ == 0 ? currentPattern_.firstBuzzerOnMs : currentPattern_.repeatingBuzzerOnMs;
  nextTransitionMs_ = now + pulseOnMs;
}
