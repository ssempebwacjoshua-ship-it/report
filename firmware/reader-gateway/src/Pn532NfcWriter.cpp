#include "ssamenj/Pn532NfcWriter.h"

#include <Wire.h>
#include <cstring>

namespace {
constexpr uint8_t kFirstUserPage = 4;
constexpr size_t kMaxNdefBytes = 144;
constexpr unsigned long kTagWaitTimeoutMs = 8000;

bool isPn532I2c(const String& type) {
  return type.equalsIgnoreCase("PN532_I2C");
}
}  // namespace

bool Pn532NfcWriter::begin(const ReaderGatewayConfig& config) {
  enabled_ = config.nfcWriterEnabled && isPn532I2c(config.nfcWriterType);
  ready_ = false;
  lastError_ = "";
  transport_.reset();
  reader_.reset();

  if (!enabled_) {
    lastError_ = "PN532 writer is disabled in firmware config.";
    return false;
  }

  Wire.begin(config.nfcWriterSdaPin, config.nfcWriterSclPin);
  transport_.reset(new PN532_I2C(Wire));
  reader_.reset(new PN532(*transport_));
  reader_->begin();
  const uint32_t version = reader_->getFirmwareVersion();
  if (version == 0) {
    lastError_ = "PN532 writer module was not detected on the configured I2C bus.";
    return false;
  }

  reader_->SAMConfig();
  ready_ = true;
  return true;
}

bool Pn532NfcWriter::isEnabled() const {
  return enabled_;
}

bool Pn532NfcWriter::isReady() const {
  return ready_;
}

const String& Pn532NfcWriter::lastError() const {
  return lastError_;
}

bool Pn532NfcWriter::waitForTagPresent(String& errorMessage) {
  uint8_t uid[7] = {0};
  uint8_t uidLength = 0;
  const unsigned long startedAt = millis();
  while (millis() - startedAt < kTagWaitTimeoutMs) {
    if (reader_ != nullptr && reader_->readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength)) {
      return true;
    }
    delay(100);
  }

  errorMessage = "No NFC tag was presented to the PN532 writer before the timeout.";
  return false;
}

bool Pn532NfcWriter::encodeTextPayload(
  const String& text,
  std::unique_ptr<uint8_t[]>& bytes,
  size_t& length,
  String& errorMessage
) const {
  const size_t textLength = static_cast<size_t>(text.length());
  const size_t recordPayloadLength = 1 + 2 + textLength;
  const size_t ndefRecordLength = 4 + recordPayloadLength;
  const size_t totalLength = 2 + ndefRecordLength + 1;
  if (recordPayloadLength > 255 || ndefRecordLength > 255 || totalLength > kMaxNdefBytes) {
    errorMessage = "Payload is too large for PN532 NDEF text writing.";
    return false;
  }

  bytes.reset(new uint8_t[totalLength]);
  size_t index = 0;
  bytes[index++] = 0x03;
  bytes[index++] = static_cast<uint8_t>(ndefRecordLength);
  bytes[index++] = 0xD1;
  bytes[index++] = 0x01;
  bytes[index++] = static_cast<uint8_t>(recordPayloadLength);
  bytes[index++] = 'T';
  bytes[index++] = 0x02;
  bytes[index++] = 'e';
  bytes[index++] = 'n';
  for (size_t i = 0; i < textLength; i += 1) {
    bytes[index++] = static_cast<uint8_t>(text[i]);
  }
  bytes[index++] = 0xFE;
  length = index;
  return true;
}

bool Pn532NfcWriter::writeNdefBytes(const uint8_t* data, size_t length, String& errorMessage) {
  const size_t pageCount = (length + 3) / 4;
  for (size_t pageOffset = 0; pageOffset < pageCount; pageOffset += 1) {
    uint8_t pageData[4] = {0, 0, 0, 0};
    for (size_t byteOffset = 0; byteOffset < 4; byteOffset += 1) {
      const size_t sourceIndex = pageOffset * 4 + byteOffset;
      if (sourceIndex < length) {
        pageData[byteOffset] = data[sourceIndex];
      }
    }

    if (reader_ == nullptr || !reader_->mifareultralight_WritePage(static_cast<uint8_t>(kFirstUserPage + pageOffset), pageData)) {
      errorMessage = "PN532 failed while writing NDEF data to the NFC tag.";
      return false;
    }
  }

  return true;
}

bool Pn532NfcWriter::readNdefTextPayload(String& payload, String& errorMessage) {
  payload = "";
  uint8_t buffer[kMaxNdefBytes] = {0};
  size_t length = 0;
  for (uint8_t page = kFirstUserPage; page < kFirstUserPage + 36 && length + 4 <= sizeof(buffer); page += 1) {
    uint8_t chunk[4] = {0};
    if (reader_ == nullptr || !reader_->mifareultralight_ReadPage(page, chunk)) {
      errorMessage = "PN532 failed while reading back NFC tag payload.";
      return false;
    }

    memcpy(buffer + length, chunk, sizeof(chunk));
    length += sizeof(chunk);
    bool foundTerminator = false;
    for (size_t i = 0; i < length; i += 1) {
      if (buffer[i] == 0xFE) {
        length = i + 1;
        foundTerminator = true;
        break;
      }
    }
    if (foundTerminator) {
      break;
    }
  }

  if (length < 9 || buffer[0] != 0x03) {
    errorMessage = "Readback payload did not contain a valid NDEF text record.";
    return false;
  }

  const uint8_t tlvLength = buffer[1];
  if (tlvLength + 3 > length) {
    errorMessage = "Readback payload length was incomplete.";
    return false;
  }

  if (buffer[2] != 0xD1 || buffer[3] != 0x01 || buffer[5] != 'T') {
    errorMessage = "Readback payload was not the expected NDEF text record format.";
    return false;
  }

  const uint8_t payloadLength = buffer[4];
  const uint8_t languageLength = buffer[6] & 0x3F;
  if (payloadLength < 1 + languageLength) {
    errorMessage = "Readback text payload metadata was invalid.";
    return false;
  }

  const size_t textStart = 7 + languageLength;
  const size_t textLength = payloadLength - 1 - languageLength;
  if (textStart + textLength > length) {
    errorMessage = "Readback text payload was truncated.";
    return false;
  }

  payload.reserve(textLength);
  for (size_t i = 0; i < textLength; i += 1) {
    payload += static_cast<char>(buffer[textStart + i]);
  }
  return true;
}

bool Pn532NfcWriter::writeAndVerifyTextPayload(const String& expectedPayload, String& readbackPayload, String& errorMessage) {
  readbackPayload = "";
  errorMessage = "";
  if (!enabled_) {
    errorMessage = "PN532 writer is disabled for this reader-gateway configuration.";
    lastError_ = errorMessage;
    return false;
  }
  if (!ready_) {
    errorMessage = lastError_.isEmpty() ? "PN532 writer is not ready." : lastError_;
    return false;
  }
  if (!waitForTagPresent(errorMessage)) {
    lastError_ = errorMessage;
    return false;
  }

  std::unique_ptr<uint8_t[]> encoded;
  size_t encodedLength = 0;
  if (!encodeTextPayload(expectedPayload, encoded, encodedLength, errorMessage)) {
    lastError_ = errorMessage;
    return false;
  }
  if (!writeNdefBytes(encoded.get(), encodedLength, errorMessage)) {
    lastError_ = errorMessage;
    return false;
  }

  delay(150);
  if (!readNdefTextPayload(readbackPayload, errorMessage)) {
    lastError_ = errorMessage;
    return false;
  }
  if (readbackPayload != expectedPayload) {
    errorMessage = "PN532 readback payload did not exactly match the expected SCNFC public code payload.";
    lastError_ = errorMessage;
    return false;
  }

  lastError_ = "";
  return true;
}
