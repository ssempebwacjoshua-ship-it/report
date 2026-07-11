#pragma once

#include <cstdint>
#include <string>

struct WiegandDecodeResult {
  bool valid = false;
  std::string format;
  std::string credential;
  std::string rawBinary;
  std::string rawDecimal;
  std::string rawHex;
  std::string facilityCode;
  std::string cardNumber;
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

inline std::string binaryStringToHexString(const std::string& bits) {
  uint64_t value = 0;
  for (char bit : bits) {
    value <<= 1ULL;
    if (bit == '1') {
      value |= 1ULL;
    }
  }

  const char* hex = "0123456789ABCDEF";
  std::string output;
  bool started = false;
  for (int shift = 60; shift >= 0; shift -= 4) {
    const uint8_t nibble = static_cast<uint8_t>((value >> shift) & 0xFULL);
    if (nibble != 0 || started || shift == 0) {
      output.push_back(hex[nibble]);
      started = true;
    }
  }
  return output;
}

inline WiegandDecodeResult decodeWiegandFrame(uint64_t bits, uint8_t bitCount) {
  WiegandDecodeResult result;
  result.bitCount = bitCount;

  if (bitCount != 26 && bitCount != 34 && bitCount != 37) {
    result.format = "wiegand-" + std::to_string(bitCount);
    return result;
  }

  const std::string rawBits = wiegandBitsToBinaryString(bits, bitCount);
  result.rawBinary = rawBits;
  result.rawDecimal = binaryStringToDecimalString(rawBits);
  result.rawHex = binaryStringToHexString(rawBits);
  if (rawBits.size() < 3) {
    result.format = "wiegand-" + std::to_string(bitCount);
    return result;
  }

  result.valid = true;
  result.format = "wiegand" + std::to_string(bitCount);
  const std::string payloadBits = rawBits.substr(1, rawBits.size() - 2);
  result.credential = binaryStringToDecimalString(payloadBits);

  if (bitCount == 26) {
    result.facilityCode = binaryStringToDecimalString(rawBits.substr(1, 8));
    result.cardNumber = binaryStringToDecimalString(rawBits.substr(9, 16));
  } else if (bitCount == 34) {
    result.facilityCode = binaryStringToDecimalString(rawBits.substr(1, 16));
    result.cardNumber = binaryStringToDecimalString(rawBits.substr(17, 16));
  }
  return result;
}
