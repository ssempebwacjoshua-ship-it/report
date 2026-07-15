#pragma once

#include <cstdint>
#include <string>

struct WiegandDecodeResult {
  bool valid = false;
  bool parityValid = false;
  std::string format;
  std::string credential;
  std::string rawBinary;
  std::string rawDecimal;
  std::string rawHex;
  std::string facilityCode;
  std::string cardNumber;
  std::string parityResult;
  uint8_t bitCount = 0;
};

inline std::string wiegandBitsToBinaryString(uint64_t bits, uint8_t bitCount) {
  std::string result;
  result.reserve(bitCount);

  for (int index = static_cast<int>(bitCount) - 1; index >= 0; --index) {
    const bool bitSet = ((bits >> index) & 0x1ULL) != 0;
    result.push_back(bitSet ? '1' : '0');
  }

  return result;
}

inline uint8_t countSetBits(const std::string& bits) {
  uint8_t count = 0;
  for (char bit : bits) {
    if (bit == '1') {
      count += 1;
    }
  }
  return count;
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

  const std::string rawBits = wiegandBitsToBinaryString(bits, bitCount);
  result.rawBinary = rawBits;
  result.rawDecimal = binaryStringToDecimalString(rawBits);
  result.rawHex = binaryStringToHexString(rawBits);
  if (rawBits.size() < 3) {
    result.format = "wiegand-" + std::to_string(bitCount);
    result.parityResult = "frame too short";
    return result;
  }

  if (bitCount != 26 && bitCount != 34 && bitCount != 36) {
    result.format = "wiegand-" + std::to_string(bitCount);
    result.parityResult = "unsupported bit count";
    return result;
  }

  result.format = "wiegand" + std::to_string(bitCount);
  result.parityValid = false;
  if (bitCount == 26) {
    const std::string topBits = rawBits.substr(0, 13);
    const std::string bottomBits = rawBits.substr(13, 13);
    const bool topParityOk = (countSetBits(topBits) % 2U) == 0U;
    const bool bottomParityOk = (countSetBits(bottomBits) % 2U) == 1U;
    result.parityValid = topParityOk && bottomParityOk;
    result.parityResult = result.parityValid ? "ok" : (topParityOk ? "bottom parity failed" : (bottomParityOk ? "top parity failed" : "top and bottom parity failed"));
    result.facilityCode = binaryStringToDecimalString(rawBits.substr(1, 8));
    result.cardNumber = binaryStringToDecimalString(rawBits.substr(9, 16));
  } else if (bitCount == 34) {
    const std::string topBits = rawBits.substr(0, 17);
    const std::string bottomBits = rawBits.substr(17, 17);
    const bool topParityOk = (countSetBits(topBits) % 2U) == 0U;
    const bool bottomParityOk = (countSetBits(bottomBits) % 2U) == 1U;
    result.parityValid = topParityOk && bottomParityOk;
    result.parityResult = result.parityValid ? "ok" : (topParityOk ? "bottom parity failed" : (bottomParityOk ? "top parity failed" : "top and bottom parity failed"));
    result.facilityCode = binaryStringToDecimalString(rawBits.substr(1, 16));
    result.cardNumber = binaryStringToDecimalString(rawBits.substr(17, 16));
  } else if (bitCount == 36) {
    const std::string topBits = rawBits.substr(0, 18);
    const std::string bottomBits = rawBits.substr(18, 18);
    const bool topParityOk = (countSetBits(topBits) % 2U) == 0U;
    const bool bottomParityOk = (countSetBits(bottomBits) % 2U) == 1U;
    result.parityValid = topParityOk && bottomParityOk;
    result.parityResult = result.parityValid ? "ok" : (topParityOk ? "bottom parity failed" : (bottomParityOk ? "top parity failed" : "top and bottom parity failed"));
    result.facilityCode = binaryStringToDecimalString(rawBits.substr(1, 17));
    result.cardNumber = binaryStringToDecimalString(rawBits.substr(18, 17));
  }
  result.credential = binaryStringToDecimalString(rawBits.substr(1, rawBits.size() - 2));
  result.valid = result.parityValid;
  return result;
}
