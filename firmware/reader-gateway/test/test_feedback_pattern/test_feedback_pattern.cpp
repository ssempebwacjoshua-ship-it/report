#include <unity.h>

#include "ssamenj/BeepToneMapping.h"
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

void test_warning_is_one_long_pulse() {
  const FeedbackPattern pattern = feedbackPatternForTone(GatewayFeedbackTone::Warning);
  TEST_ASSERT_EQUAL_UINT8(1, pattern.buzzerPulses);
  TEST_ASSERT_EQUAL_UINT16(420, pattern.firstBuzzerOnMs);
  TEST_ASSERT_FALSE(pattern.ledEnabled);
}

void test_error_is_one_long_pulse() {
  const FeedbackPattern pattern = feedbackPatternForTone(GatewayFeedbackTone::Error);
  TEST_ASSERT_EQUAL_UINT8(1, pattern.buzzerPulses);
  TEST_ASSERT_EQUAL_UINT16(420, pattern.firstBuzzerOnMs);
  TEST_ASSERT_FALSE(pattern.ledEnabled);
}

void test_offline_is_one_short_then_one_long_pulse() {
  const FeedbackPattern pattern = feedbackPatternForTone(GatewayFeedbackTone::Offline);
  TEST_ASSERT_EQUAL_UINT8(2, pattern.buzzerPulses);
  TEST_ASSERT_EQUAL_UINT16(100, pattern.firstBuzzerOnMs);
  TEST_ASSERT_EQUAL_UINT16(320, pattern.repeatingBuzzerOnMs);
  TEST_ASSERT_FALSE(pattern.ledEnabled);
}

void test_legacy_unknown_maps_to_error_tone() {
  TEST_ASSERT_EQUAL_INT(static_cast<int>(GatewayFeedbackTone::Error), static_cast<int>(feedbackToneFromBeepValue("unknown")));
}

void test_legacy_denied_aliases_map_to_error_tone() {
  TEST_ASSERT_EQUAL_INT(static_cast<int>(GatewayFeedbackTone::Error), static_cast<int>(feedbackToneFromBeepValue("blocked")));
  TEST_ASSERT_EQUAL_INT(static_cast<int>(GatewayFeedbackTone::Error), static_cast<int>(feedbackToneFromBeepValue("failed")));
  TEST_ASSERT_EQUAL_INT(static_cast<int>(GatewayFeedbackTone::Error), static_cast<int>(feedbackToneFromBeepValue("denied")));
}

void test_offline_queued_maps_to_offline_tone() {
  TEST_ASSERT_EQUAL_INT(static_cast<int>(GatewayFeedbackTone::Offline), static_cast<int>(feedbackToneFromBeepValue("offline_queued")));
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_success_is_one_short_pulse);
  RUN_TEST(test_duplicate_is_two_short_pulses);
  RUN_TEST(test_warning_is_one_long_pulse);
  RUN_TEST(test_error_is_one_long_pulse);
  RUN_TEST(test_offline_is_one_short_then_one_long_pulse);
  RUN_TEST(test_legacy_unknown_maps_to_error_tone);
  RUN_TEST(test_legacy_denied_aliases_map_to_error_tone);
  RUN_TEST(test_offline_queued_maps_to_offline_tone);
  return UNITY_END();
}
