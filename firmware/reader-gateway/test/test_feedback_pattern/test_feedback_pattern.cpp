#include <unity.h>

#include "ssamenj/FeedbackPattern.h"

void test_success_is_one_short_pulse() {
  const FeedbackPattern pattern = feedbackPatternForTone(GatewayFeedbackTone::Success);
  TEST_ASSERT_EQUAL_UINT8(1, pattern.buzzerPulses);
  TEST_ASSERT_EQUAL_UINT16(120, pattern.firstBuzzerOnMs);
  TEST_ASSERT_EQUAL_UINT16(120, pattern.repeatingBuzzerOnMs);
  TEST_ASSERT_TRUE(pattern.ledEnabled);
  TEST_ASSERT_EQUAL_UINT16(800, pattern.ledOnMs);
}

void test_duplicate_is_two_short_pulses() {
  const FeedbackPattern pattern = feedbackPatternForTone(GatewayFeedbackTone::Duplicate);
  TEST_ASSERT_EQUAL_UINT8(2, pattern.buzzerPulses);
  TEST_ASSERT_EQUAL_UINT16(100, pattern.firstBuzzerOnMs);
  TEST_ASSERT_EQUAL_UINT16(100, pattern.repeatingBuzzerOnMs);
  TEST_ASSERT_FALSE(pattern.ledEnabled);
}

void test_out_of_session_is_one_long_pulse() {
  const FeedbackPattern pattern = feedbackPatternForTone(GatewayFeedbackTone::OutOfSession);
  TEST_ASSERT_EQUAL_UINT8(1, pattern.buzzerPulses);
  TEST_ASSERT_EQUAL_UINT16(420, pattern.firstBuzzerOnMs);
  TEST_ASSERT_FALSE(pattern.ledEnabled);
}

void test_unknown_is_three_fast_error_pulses() {
  const FeedbackPattern pattern = feedbackPatternForTone(GatewayFeedbackTone::Unknown);
  TEST_ASSERT_EQUAL_UINT8(3, pattern.buzzerPulses);
  TEST_ASSERT_EQUAL_UINT16(90, pattern.firstBuzzerOnMs);
  TEST_ASSERT_EQUAL_UINT16(90, pattern.repeatingBuzzerOnMs);
  TEST_ASSERT_FALSE(pattern.ledEnabled);
}

void test_queued_is_one_short_then_one_long_pulse() {
  const FeedbackPattern pattern = feedbackPatternForTone(GatewayFeedbackTone::Queued);
  TEST_ASSERT_EQUAL_UINT8(2, pattern.buzzerPulses);
  TEST_ASSERT_EQUAL_UINT16(100, pattern.firstBuzzerOnMs);
  TEST_ASSERT_EQUAL_UINT16(320, pattern.repeatingBuzzerOnMs);
  TEST_ASSERT_FALSE(pattern.ledEnabled);
}

void test_error_is_two_long_pulses() {
  const FeedbackPattern pattern = feedbackPatternForTone(GatewayFeedbackTone::Error);
  TEST_ASSERT_EQUAL_UINT8(2, pattern.buzzerPulses);
  TEST_ASSERT_EQUAL_UINT16(360, pattern.firstBuzzerOnMs);
  TEST_ASSERT_EQUAL_UINT16(360, pattern.repeatingBuzzerOnMs);
  TEST_ASSERT_FALSE(pattern.ledEnabled);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_success_is_one_short_pulse);
  RUN_TEST(test_duplicate_is_two_short_pulses);
  RUN_TEST(test_out_of_session_is_one_long_pulse);
  RUN_TEST(test_unknown_is_three_fast_error_pulses);
  RUN_TEST(test_queued_is_one_short_then_one_long_pulse);
  RUN_TEST(test_error_is_two_long_pulses);
  return UNITY_END();
}
