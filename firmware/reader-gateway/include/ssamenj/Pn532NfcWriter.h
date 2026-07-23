#pragma once

#include <Arduino.h>
#include <PN532.h>
#include <PN532_I2C.h>
#include <memory>

#include "GatewayTypes.h"

class Pn532NfcWriter {
 public:
  bool begin(const ReaderGatewayConfig& config);
  bool isEnabled() const;
  bool isReady() const;
  const String& lastError() const;
  bool writeAndVerifyTextPayload(const String& expectedPayload, String& readbackPayload, String& errorMessage);

 private:
  bool waitForTagPresent(String& errorMessage);
  bool encodeTextPayload(const String& text, std::unique_ptr<uint8_t[]>& bytes, size_t& length, String& errorMessage) const;
  bool writeNdefBytes(const uint8_t* data, size_t length, String& errorMessage);
  bool readNdefTextPayload(String& payload, String& errorMessage);

  bool enabled_ = false;
  bool ready_ = false;
  String lastError_;
  std::unique_ptr<PN532_I2C> transport_;
  std::unique_ptr<PN532> reader_;
};
