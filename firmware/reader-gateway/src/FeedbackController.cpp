#include "ssamenj/FeedbackController.h"

void FeedbackController::begin(const ReaderGatewayConfig& config) {
  (void)config;
  Serial.println("Feedback outputs disabled");
}

void FeedbackController::play(GatewayFeedbackTone tone) {
  if (tone == GatewayFeedbackTone::None) {
    return;
  }

  Serial.printf("Feedback tone suppressed: %d\n", static_cast<int>(tone));
}

void FeedbackController::loop() {
}
