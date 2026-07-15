#include <unity.h>

#include "ssamenj/WiegandDecoder.h"

void setUp() {}

void tearDown() {}

namespace {
uint8_t countBits(uint64_t value) {
  uint8_t count = 0;
  while (value != 0) {
    count += static_cast<uint8_t>(value & 0x1ULL);
    value >>= 1ULL;
  }
  return count;
}

uint64_t buildWiegand26(uint8_t facilityCode, uint16_t cardNumber) {
  uint64_t frame = (static_cast<uint64_t>(facilityCode) << 17) | (static_cast<uint64_t>(cardNumber) << 1);
  if ((countBits((frame >> 13) & 0x1FFFULL) % 2U) != 0U) {
    frame |= (1ULL << 25);
  }
  if ((countBits((frame >> 1) & 0xFFFULL) % 2U) == 0U) {
    frame |= 1ULL;
  }
  return frame;
}

uint64_t buildWiegand34(uint16_t facilityCode, uint16_t cardNumber) {
  uint64_t frame = (static_cast<uint64_t>(facilityCode) << 17) | (static_cast<uint64_t>(cardNumber) << 1);
  if ((countBits((frame >> 17) & 0xFFFFULL) % 2U) != 0U) {
    frame |= (1ULL << 33);
  }
  if ((countBits((frame >> 1) & 0xFFFFULL) % 2U) == 0U) {
    frame |= 1ULL;
  }
  return frame;
}

uint64_t buildWiegand36(uint32_t facilityCode, uint32_t cardNumber) {
  uint64_t frame = (static_cast<uint64_t>(facilityCode) << 18) | (static_cast<uint64_t>(cardNumber) << 1);
  if ((countBits((frame >> 18) & 0x3FFFFULL) % 2U) != 0U) {
    frame |= (1ULL << 35);
  }
  if ((countBits((frame >> 1) & 0x3FFFFULL) % 2U) == 0U) {
    frame |= 1ULL;
  }
  return frame;
}
}  // namespace

void test_decodes_wiegand26_payload() {
  const WiegandDecodeResult result = decodeWiegandFrame(buildWiegand26(0, 0), 26);
  TEST_ASSERT_TRUE(result.valid);
  TEST_ASSERT_TRUE(result.parityValid);
  TEST_ASSERT_EQUAL_STRING("ok", result.parityResult.c_str());
  TEST_ASSERT_EQUAL_STRING("wiegand26", result.format.c_str());
  TEST_ASSERT_EQUAL_STRING("0", result.credential.c_str());
  TEST_ASSERT_EQUAL_STRING("00000000000000000000000001", result.rawBinary.c_str());
  TEST_ASSERT_EQUAL_STRING("1", result.rawDecimal.c_str());
  TEST_ASSERT_EQUAL_STRING("1", result.rawHex.c_str());
  TEST_ASSERT_EQUAL_STRING("0", result.facilityCode.c_str());
  TEST_ASSERT_EQUAL_STRING("0", result.cardNumber.c_str());
}

void test_decodes_wiegand34_payload() {
  const WiegandDecodeResult result = decodeWiegandFrame(buildWiegand34(0, 0), 34);
  TEST_ASSERT_TRUE(result.valid);
  TEST_ASSERT_TRUE(result.parityValid);
  TEST_ASSERT_EQUAL_STRING("ok", result.parityResult.c_str());
  TEST_ASSERT_EQUAL_STRING("wiegand34", result.format.c_str());
  TEST_ASSERT_EQUAL_STRING("0", result.credential.c_str());
  TEST_ASSERT_EQUAL_STRING("0", result.facilityCode.c_str());
  TEST_ASSERT_EQUAL_STRING("0", result.cardNumber.c_str());
}

void test_decodes_wiegand26_facility_and_card() {
  const WiegandDecodeResult result = decodeWiegandFrame(buildWiegand26(12, 345), 26);
  TEST_ASSERT_TRUE(result.valid);
  TEST_ASSERT_TRUE(result.parityValid);
  TEST_ASSERT_EQUAL_STRING("786777", result.credential.c_str());
  TEST_ASSERT_EQUAL_STRING("12", result.facilityCode.c_str());
  TEST_ASSERT_EQUAL_STRING("345", result.cardNumber.c_str());
}

void test_marks_wrong_parity_invalid() {
  const uint64_t frame = buildWiegand26(12, 345) ^ (1ULL << 25);
  const WiegandDecodeResult result = decodeWiegandFrame(frame, 26);
  TEST_ASSERT_FALSE(result.valid);
  TEST_ASSERT_FALSE(result.parityValid);
  TEST_ASSERT_EQUAL_STRING("top parity failed", result.parityResult.c_str());
}

void test_decodes_wiegand36_payload() {
  const WiegandDecodeResult result = decodeWiegandFrame(buildWiegand36(1, 1), 36);
  TEST_ASSERT_TRUE(result.valid);
  TEST_ASSERT_TRUE(result.parityValid);
  TEST_ASSERT_EQUAL_STRING("ok", result.parityResult.c_str());
  TEST_ASSERT_EQUAL_STRING("wiegand36", result.format.c_str());
  TEST_ASSERT_EQUAL_STRING("1", result.credential.c_str());
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_decodes_wiegand26_payload);
  RUN_TEST(test_decodes_wiegand34_payload);
  RUN_TEST(test_decodes_wiegand26_facility_and_card);
  RUN_TEST(test_marks_wrong_parity_invalid);
  RUN_TEST(test_decodes_wiegand36_payload);
  return UNITY_END();
}
