#pragma once

#include <Arduino.h>

#include "GatewayTypes.h"
#include "WiegandDecoder.h"

class WiegandReader {
 public:
  bool begin(int8_t d0Pin, int8_t d1Pin, uint32_t timeoutMs);
  bool poll(ReaderScanEvent& event);
  void reset();

 private:
  static void IRAM_ATTR onD0Thunk(void* arg);
  static void IRAM_ATTR onD1Thunk(void* arg);
  void IRAM_ATTR onPulse(bool oneBit);

  volatile uint64_t frameBits_ = 0;
  volatile uint8_t bitCount_ = 0;
  volatile uint32_t lastPulseMs_ = 0;
  int8_t d0Pin_ = -1;
  int8_t d1Pin_ = -1;
  uint32_t timeoutMs_ = 30;
};
