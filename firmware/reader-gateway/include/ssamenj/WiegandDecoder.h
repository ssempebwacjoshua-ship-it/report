#pragma once

#include <cstdint>
#include <string>

struct WiegandDecodeResult {
  bool valid = false;
  std::string format;
  std::string credential;
  uint8_t bitCount = 0;
};

inline std::string wiegandBitsToBinaryString(uint64_t bits, uint8_t bitCount) {
  std::string result;
  result.reserve(bitCount);

  for (int8_t index = static_cast<int8_t>(bitCount) - 1; index >= 0; --index) {
    const bool bitSet = ((bits >> index) & 0x1ULL) != 0;
    result.push_back(bitSet ? '1' : '0');
  }

  return result;
}

inline std::string binaryStringToDecimalString(const std::string& bits) {
  uint64_t value = 0;
  for (char bit : bits) {
    value <<= 1ULL;
    if (bit == '1') {
      value |= 1ULL;
    }
  }
  return std::to_string(value);
}

inline WiegandDecodeResult decodeWiegandFrame(uint64_t bits, uint8_t bitCount) {
  WiegandDecodeResult result;
  result.bitCount = bitCount;

  if (bitCount != 26 && bitCount != 34 && bitCount != 37) {
    result.format = "wiegand-" + std::to_string(bitCount);
    return result;
  }

  const std::string rawBits = wiegandBitsToBinaryString(bits, bitCount);
  if (rawBits.size() < 3) {
    result.format = "wiegand-" + std::to_string(bitCount);
    return result;
  }

  result.valid = true;
  result.format = "wiegand" + std::to_string(bitCount);
  result.credential = binaryStringToDecimalString(rawBits.substr(1, rawBits.size() - 2));
  return result;
}
