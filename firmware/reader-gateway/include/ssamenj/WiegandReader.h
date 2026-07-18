#pragma once

#include <Arduino.h>

#include "GatewayTypes.h"
#include "WiegandDecoder.h"

class WiegandReader {
 public:
  bool begin(int8_t d0Pin, int8_t d1Pin, uint32_t timeoutMs);
  bool poll(ReaderScanEvent& event);
  bool hasPendingFrame() const;
  void reset();

 private:
  static constexpr uint8_t kMinFrameBits = 4;
  static constexpr uint8_t kMaxFrameBits = 64;

  struct PendingFrame {
    uint64_t bits = 0;
    uint8_t bitCount = 0;
    uint32_t firstPulseUs = 0;
    uint32_t lastPulseUs = 0;
    uint16_t d0PulseCount = 0;
    uint16_t d1PulseCount = 0;
    bool overflow = false;
    bool timedOut = false;
  };

  static constexpr uint8_t kPendingFrameCapacity = 8;
  static constexpr uint32_t kMinPulseSpacingUs = 150;

  static void IRAM_ATTR onD0Thunk(void* arg);
  static void IRAM_ATTR onD1Thunk(void* arg);
  void IRAM_ATTR onPulse(bool oneBit);
  void IRAM_ATTR finalizeActiveFrame(bool timedOut);
  bool tryFinalizeTimedOutFrame();
  bool popPendingFrame(PendingFrame& frame);
  void logRejectedFrame(const PendingFrame& frame, const WiegandDecodeResult& decoded, const char* reason) const;

  volatile uint64_t activeFrameBits_ = 0;
  volatile uint8_t activeBitCount_ = 0;
  volatile uint32_t activeFirstPulseUs_ = 0;
  volatile uint32_t activeLastPulseUs_ = 0;
  volatile uint16_t activeD0PulseCount_ = 0;
  volatile uint16_t activeD1PulseCount_ = 0;
  volatile bool activeOverflow_ = false;
  PendingFrame pendingFrames_[kPendingFrameCapacity] {};
  volatile uint8_t pendingHead_ = 0;
  volatile uint8_t pendingTail_ = 0;
  volatile uint8_t pendingCount_ = 0;
  volatile uint32_t timeoutUs_ = 30000;
  volatile uint32_t droppedFrames_ = 0;
  int8_t d0Pin_ = -1;
  int8_t d1Pin_ = -1;
  mutable unsigned long lastRejectedLogMs_ = 0;
};
