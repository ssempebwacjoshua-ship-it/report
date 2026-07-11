#include <unity.h>

#include "ssamenj/FeedbackPattern.h"

void test_success_is_one_short_pulse() {
  const FeedbackPattern pattern = feedbackPatternForTone(GatewayFeedbackTone::Success);
  TEST_ASSERT_EQUAL_UINT8(1, pattern.pulses);
  TEST_ASSERT_EQUAL_UINT16(100, pattern.onMs);
}

void test_duplicate_is_two_short_pulses() {
  const FeedbackPattern pattern = feedbackPatternForTone(GatewayFeedbackTone::Duplicate);
  TEST_ASSERT_EQUAL_UINT8(2, pattern.pulses);
  TEST_ASSERT_EQUAL_UINT16(100, pattern.onMs);
}

void test_error_is_one_long_pulse() {
  const FeedbackPattern pattern = feedbackPatternForTone(GatewayFeedbackTone::Error);
  TEST_ASSERT_EQUAL_UINT8(1, pattern.pulses);
  TEST_ASSERT_GREATER_THAN_UINT16(500, pattern.onMs);
}

void test_offline_is_three_short_pulses() {
  const FeedbackPattern pattern = feedbackPatternForTone(GatewayFeedbackTone::Offline);
  TEST_ASSERT_EQUAL_UINT8(3, pattern.pulses);
  TEST_ASSERT_EQUAL_UINT16(100, pattern.onMs);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_success_is_one_short_pulse);
  RUN_TEST(test_duplicate_is_two_short_pulses);
  RUN_TEST(test_error_is_one_long_pulse);
  RUN_TEST(test_offline_is_three_short_pulses);
  return UNITY_END();
}
