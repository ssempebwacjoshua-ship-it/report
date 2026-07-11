#include <unity.h>

#include "ssamenj/WiegandDecoder.h"

void setUp() {}

void tearDown() {}

void test_decodes_wiegand26_payload() {
  const WiegandDecodeResult result = decodeWiegandFrame((1ULL << 25) | 1ULL, 26);
  TEST_ASSERT_TRUE(result.valid);
  TEST_ASSERT_EQUAL_STRING("wiegand26", result.format.c_str());
  TEST_ASSERT_EQUAL_STRING("0", result.credential.c_str());
  TEST_ASSERT_EQUAL_STRING("10000000000000000000000001", result.rawBinary.c_str());
  TEST_ASSERT_EQUAL_STRING("33554433", result.rawDecimal.c_str());
  TEST_ASSERT_EQUAL_STRING("2000001", result.rawHex.c_str());
  TEST_ASSERT_EQUAL_STRING("0", result.facilityCode.c_str());
  TEST_ASSERT_EQUAL_STRING("0", result.cardNumber.c_str());
}

void test_decodes_wiegand34_payload() {
  const WiegandDecodeResult result = decodeWiegandFrame((1ULL << 33) | 1ULL, 34);
  TEST_ASSERT_TRUE(result.valid);
  TEST_ASSERT_EQUAL_STRING("wiegand34", result.format.c_str());
  TEST_ASSERT_EQUAL_STRING("0", result.credential.c_str());
  TEST_ASSERT_EQUAL_STRING("0", result.facilityCode.c_str());
  TEST_ASSERT_EQUAL_STRING("0", result.cardNumber.c_str());
}

void test_decodes_wiegand26_facility_and_card() {
  const uint64_t bits = (1ULL << 25) | (12ULL << 17) | (345ULL << 1) | 1ULL;
  const WiegandDecodeResult result = decodeWiegandFrame(bits, 26);
  TEST_ASSERT_TRUE(result.valid);
  TEST_ASSERT_EQUAL_STRING("786777", result.credential.c_str());
  TEST_ASSERT_EQUAL_STRING("12", result.facilityCode.c_str());
  TEST_ASSERT_EQUAL_STRING("345", result.cardNumber.c_str());
}

void test_marks_unknown_format_invalid() {
  const WiegandDecodeResult result = decodeWiegandFrame(0b10101010ULL, 8);
  TEST_ASSERT_FALSE(result.valid);
  TEST_ASSERT_EQUAL_STRING("wiegand-8", result.format.c_str());
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_decodes_wiegand26_payload);
  RUN_TEST(test_decodes_wiegand34_payload);
  RUN_TEST(test_decodes_wiegand26_facility_and_card);
  RUN_TEST(test_marks_unknown_format_invalid);
  return UNITY_END();
}
