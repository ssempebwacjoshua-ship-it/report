#include <unity.h>

#include "ssamenj/WiegandDecoder.h"

void test_decodes_wiegand26_payload() {
  const WiegandDecodeResult result = decodeWiegandFrame((1ULL << 25) | 1ULL, 26);
  TEST_ASSERT_TRUE(result.valid);
  TEST_ASSERT_EQUAL_STRING("wiegand26", result.format.c_str());
  TEST_ASSERT_EQUAL_STRING("0", result.credential.c_str());
}

void test_decodes_wiegand34_payload() {
  const WiegandDecodeResult result = decodeWiegandFrame((1ULL << 33) | 1ULL, 34);
  TEST_ASSERT_TRUE(result.valid);
  TEST_ASSERT_EQUAL_STRING("wiegand34", result.format.c_str());
  TEST_ASSERT_EQUAL_STRING("0", result.credential.c_str());
}

void test_marks_unknown_format_invalid() {
  const WiegandDecodeResult result = decodeWiegandFrame(0b10101010ULL, 8);
  TEST_ASSERT_FALSE(result.valid);
  TEST_ASSERT_EQUAL_STRING("wiegand-8", result.format.c_str());
}

void setup() {
  UNITY_BEGIN();
  RUN_TEST(test_decodes_wiegand26_payload);
  RUN_TEST(test_decodes_wiegand34_payload);
  RUN_TEST(test_marks_unknown_format_invalid);
  UNITY_END();
}

void loop() {}
