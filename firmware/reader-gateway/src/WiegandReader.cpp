#include "ssamenj/WiegandReader.h"

bool WiegandReader::begin(int8_t d0Pin, int8_t d1Pin, uint32_t timeoutMs) {
  d0Pin_ = d0Pin;
  d1Pin_ = d1Pin;
  timeoutMs_ = timeoutMs;

  pinMode(d0Pin_, INPUT_PULLUP);
  pinMode(d1Pin_, INPUT_PULLUP);

  attachInterruptArg(d0Pin_, &WiegandReader::onD0Thunk, this, FALLING);
  attachInterruptArg(d1Pin_, &WiegandReader::onD1Thunk, this, FALLING);
  reset();
  return true;
}

void WiegandReader::reset() {
  noInterrupts();
  frameBits_ = 0;
  bitCount_ = 0;
  lastPulseMs_ = millis();
  interrupts();
}

void IRAM_ATTR WiegandReader::onD0Thunk(void* arg) {
  static_cast<WiegandReader*>(arg)->onPulse(false);
}

void IRAM_ATTR WiegandReader::onD1Thunk(void* arg) {
  static_cast<WiegandReader*>(arg)->onPulse(true);
}

void IRAM_ATTR WiegandReader::onPulse(bool oneBit) {
  if (bitCount_ < 63) {
    frameBits_ = (frameBits_ << 1ULL) | (oneBit ? 1ULL : 0ULL);
    ++bitCount_;
  }
  lastPulseMs_ = millis();
}

bool WiegandReader::poll(ReaderScanEvent& event) {
  noInterrupts();
  const uint8_t currentBitCount = bitCount_;
  const uint32_t lastPulseMs = lastPulseMs_;
  interrupts();

  if (currentBitCount == 0) {
    return false;
  }

  const uint32_t elapsed = millis() - lastPulseMs;
  if (elapsed < timeoutMs_) {
    return false;
  }

  noInterrupts();
  const uint64_t frameBits = frameBits_;
  const uint8_t bits = bitCount_;
  frameBits_ = 0;
  bitCount_ = 0;
  lastPulseMs_ = millis();
  interrupts();

  const WiegandDecodeResult decoded = decodeWiegandFrame(frameBits, bits);
  if (!decoded.valid) {
    Serial.printf("Reader rejected frame: bitCount=%u rawBits=%s rawDecimal=%s rawHex=%s\n",
      static_cast<unsigned int>(decoded.bitCount),
      decoded.rawBinary.c_str(),
      decoded.rawDecimal.c_str(),
      decoded.rawHex.c_str());
    return false;
  }

  event = ReaderScanEvent{};
  event.credential = String(decoded.credential.c_str());
  event.format = String(decoded.format.c_str());
  event.rawWiegandBitCount = decoded.bitCount;
  event.rawWiegandBinary = String(decoded.rawBinary.c_str());
  event.rawWiegandDecimal = String(decoded.rawDecimal.c_str());
  event.rawWiegandHex = String(decoded.rawHex.c_str());
  event.facilityCode = String(decoded.facilityCode.c_str());
  event.cardNumber = String(decoded.cardNumber.c_str());
  return true;
}
