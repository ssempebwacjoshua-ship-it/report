import { describe, expect, it } from "vitest";
import {
  assertTrustedReaderFirmwareUrl,
  trustedReaderFirmwareUrlForRelease,
} from "../../server/services/readerDeviceCommandService";

describe("readerDeviceCommandService", () => {
  it("accepts trusted firmware download URLs", () => {
    expect(() => assertTrustedReaderFirmwareUrl(
      trustedReaderFirmwareUrlForRelease("release-101"),
    )).not.toThrow();
  });

  it("rejects untrusted firmware domains", () => {
    expect(() => assertTrustedReaderFirmwareUrl(
      "https://evil.example.com/api/readers/ota/download/release-101",
    )).toThrow(/trusted ota host/i);
  });

  it("rejects non-download firmware paths", () => {
    expect(() => assertTrustedReaderFirmwareUrl(
      "https://report-production-b00d.up.railway.app/api/private/firmware.bin",
    )).toThrow(/trusted ota download path/i);
  });
});
