#include "ssamenj/WiegandReader.h"

namespace {
constexpr uint32_t kDefaultTimeoutUs = 30000;
}

bool WiegandReader::begin(int8_t d0Pin, int8_t d1Pin, uint32_t timeoutMs) {
  d0Pin_ = d0Pin;
  d1Pin_ = d1Pin;
  timeoutUs_ = timeoutMs == 0 ? kDefaultTimeoutUs : timeoutMs * 1000UL;

  if (d0Pin_ < 0 || d1Pin_ < 0) {
    Serial.printf("Wiegand begin failed: invalid pins D0=%d D1=%d\n", static_cast<int>(d0Pin_), static_cast<int>(d1Pin_));
    return false;
  }

  pinMode(d0Pin_, INPUT_PULLUP);
  pinMode(d1Pin_, INPUT_PULLUP);

  reset();
  attachInterruptArg(d0Pin_, &WiegandReader::onD0Thunk, this, FALLING);
  attachInterruptArg(d1Pin_, &WiegandReader::onD1Thunk, this, FALLING);
  Serial.printf(
    "Wiegand begin: D0=%d D1=%d timeoutMs=%lu\n",
    static_cast<int>(d0Pin_),
    static_cast<int>(d1Pin_),
    static_cast<unsigned long>(timeoutMs == 0 ? kDefaultTimeoutUs / 1000UL : timeoutMs)
  );
  Serial.printf(
    "Wiegand pin levels after begin: D0=%s D1=%s\n",
    digitalRead(d0Pin_) == HIGH ? "HIGH" : "LOW",
    digitalRead(d1Pin_) == HIGH ? "HIGH" : "LOW"
  );
  return true;
}

bool WiegandReader::hasPendingFrame() const {
  noInterrupts();
  const bool hasActiveFrame = activeBitCount_ > 0;
  const bool hasQueuedFrames = pendingCount_ > 0;
  interrupts();
  return hasActiveFrame || hasQueuedFrames;
}

void WiegandReader::reset() {
  noInterrupts();
  activeFrameBits_ = 0;
  activeBitCount_ = 0;
  activeFirstPulseUs_ = 0;
  activeLastPulseUs_ = 0;
  activeD0PulseCount_ = 0;
  activeD1PulseCount_ = 0;
  activeOverflow_ = false;
  pendingHead_ = 0;
  pendingTail_ = 0;
  pendingCount_ = 0;
  droppedFrames_ = 0;
  interrupts();
}

void IRAM_ATTR WiegandReader::onD0Thunk(void* arg) {
  static_cast<WiegandReader*>(arg)->onPulse(false);
}

void IRAM_ATTR WiegandReader::onD1Thunk(void* arg) {
  static_cast<WiegandReader*>(arg)->onPulse(true);
}

void IRAM_ATTR WiegandReader::finalizeActiveFrame() {
  if (activeBitCount_ == 0) {
    return;
  }

  if (pendingCount_ == kPendingFrameCapacity) {
    pendingHead_ = static_cast<uint8_t>((pendingHead_ + 1) % kPendingFrameCapacity);
    pendingCount_ -= 1;
    droppedFrames_ += 1;
  }

  PendingFrame& slot = pendingFrames_[pendingTail_];
  slot.bits = activeFrameBits_;
  slot.bitCount = activeBitCount_;
  slot.firstPulseUs = activeFirstPulseUs_;
  slot.lastPulseUs = activeLastPulseUs_;
  slot.overflow = activeOverflow_;
  slot.d0PulseCount = activeD0PulseCount_;
  slot.d1PulseCount = activeD1PulseCount_;

  pendingTail_ = static_cast<uint8_t>((pendingTail_ + 1) % kPendingFrameCapacity);
  pendingCount_ += 1;

  activeFrameBits_ = 0;
  activeBitCount_ = 0;
  activeFirstPulseUs_ = 0;
  activeLastPulseUs_ = 0;
  activeD0PulseCount_ = 0;
  activeD1PulseCount_ = 0;
  activeOverflow_ = false;
}

bool WiegandReader::popPendingFrame(PendingFrame& frame) {
  noInterrupts();
  if (pendingCount_ == 0) {
    interrupts();
    return false;
  }

  frame = pendingFrames_[pendingHead_];
  pendingHead_ = static_cast<uint8_t>((pendingHead_ + 1) % kPendingFrameCapacity);
  pendingCount_ -= 1;
  const uint32_t droppedFrames = droppedFrames_;
  droppedFrames_ = 0;
  interrupts();

  if (droppedFrames > 0) {
    Serial.printf("Reader frame queue overflow: dropped=%lu\n", static_cast<unsigned long>(droppedFrames));
  }

  return true;
}

void IRAM_ATTR WiegandReader::onPulse(bool oneBit) {
  const uint32_t nowUs = micros();

  if (activeBitCount_ > 0 && static_cast<uint32_t>(nowUs - activeLastPulseUs_) >= timeoutUs_) {
    finalizeActiveFrame();
  }

  if (activeBitCount_ > 0 && static_cast<uint32_t>(nowUs - activeLastPulseUs_) < kMinPulseSpacingUs) {
    return;
  }

  if (activeBitCount_ == 0) {
    activeFirstPulseUs_ = nowUs;
  }

  if (oneBit) {
    activeD1PulseCount_ += 1;
  } else {
    activeD0PulseCount_ += 1;
  }

  if (activeBitCount_ < 63) {
    activeFrameBits_ = (activeFrameBits_ << 1ULL) | (oneBit ? 1ULL : 0ULL);
    activeBitCount_ += 1;
  } else {
    activeOverflow_ = true;
  }
  activeLastPulseUs_ = nowUs;
}

void WiegandReader::logRejectedFrame(const PendingFrame& frame, const WiegandDecodeResult& decoded, const char* reason) const {
  const unsigned long nowMs = millis();
  if (nowMs - lastRejectedLogMs_ < 1000UL) {
    return;
  }

  lastRejectedLogMs_ = nowMs;
  const uint32_t frameDurationUs = frame.lastPulseUs >= frame.firstPulseUs ? frame.lastPulseUs - frame.firstPulseUs : 0;
  Serial.printf(
    "Reader rejected frame: timestamp_ms=%lu duration_us=%lu bitCount=%u reason=%s parity=%s rawBinary=%s rawDecimal=%s rawHex=%s D0=%lu D1=%lu\n",
    nowMs,
    static_cast<unsigned long>(frameDurationUs),
    static_cast<unsigned int>(decoded.bitCount),
    reason == nullptr ? "unknown" : reason,
    decoded.parityResult.c_str(),
    decoded.rawBinary.c_str(),
    decoded.rawDecimal.c_str(),
    decoded.rawHex.c_str(),
    static_cast<unsigned long>(frame.d0PulseCount),
    static_cast<unsigned long>(frame.d1PulseCount)
  );
}

bool WiegandReader::poll(ReaderScanEvent& event) {
  noInterrupts();
  const uint32_t nowUs = micros();
  if (activeBitCount_ > 0 && static_cast<uint32_t>(nowUs - activeLastPulseUs_) >= timeoutUs_) {
    const uint8_t pendingBits = activeBitCount_;
    const uint32_t gapUs = static_cast<uint32_t>(nowUs - activeLastPulseUs_);
    finalizeActiveFrame();
    interrupts();
    Serial.printf("Reader frame timeout: bitCount=%u gap_us=%lu\n", static_cast<unsigned int>(pendingBits), static_cast<unsigned long>(gapUs));
  } else {
    interrupts();
  }

  PendingFrame frame;
  if (!popPendingFrame(frame)) {
    return false;
  }

  Serial.printf("D0 pulse interrupt fired: count=%lu\n", static_cast<unsigned long>(frame.d0PulseCount));
  Serial.printf("D1 pulse interrupt fired: count=%lu\n", static_cast<unsigned long>(frame.d1PulseCount));

  const WiegandDecodeResult decoded = decodeWiegandFrame(frame.bits, frame.bitCount);
  if (!decoded.valid) {
    const char* reason = "unknown";
    if (frame.overflow && frame.bits == 0) {
      reason = "all-zero overflow frame";
    } else if (frame.overflow) {
      reason = "frame overflow";
    } else if (decoded.parityResult == "unsupported bit count") {
      reason = "unsupported bit count";
    } else if (decoded.parityResult == "all-zero frame" || frame.bits == 0) {
      reason = "all-zero frame";
    } else if (decoded.parityResult.find("parity failed") != std::string::npos) {
      reason = decoded.parityResult.c_str();
    } else {
      reason = decoded.parityResult.c_str();
    }
    logRejectedFrame(frame, decoded, reason);
    return false;
  }

  const uint32_t frameDurationUs = frame.lastPulseUs >= frame.firstPulseUs ? frame.lastPulseUs - frame.firstPulseUs : 0;
  Serial.printf("Wiegand bits: %u\n", static_cast<unsigned int>(decoded.bitCount));
  Serial.printf("Card value: %s\n", decoded.rawDecimal.c_str());
  Serial.printf(
    "Reader frame captured: timestamp_ms=%lu duration_us=%lu bitCount=%u rawBinary=%s rawDecimal=%s rawHex=%s facilityCode=%s cardNumber=%s parity=%s\n",
    static_cast<unsigned long>(millis()),
    static_cast<unsigned long>(frameDurationUs),
    static_cast<unsigned int>(decoded.bitCount),
    decoded.rawBinary.c_str(),
    decoded.rawDecimal.c_str(),
    decoded.rawHex.c_str(),
    decoded.facilityCode.empty() ? "-" : decoded.facilityCode.c_str(),
    decoded.cardNumber.empty() ? "-" : decoded.cardNumber.c_str(),
    decoded.parityResult.c_str()
  );

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
