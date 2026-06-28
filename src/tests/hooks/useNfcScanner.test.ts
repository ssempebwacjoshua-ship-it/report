import { describe, expect, it } from "vitest";
import { normalizeNfcScannerError } from "../../hooks/useNfcScanner";

describe("normalizeNfcScannerError", () => {
  it("maps permission errors to a helpful NFC message", () => {
    expect(normalizeNfcScannerError(new DOMException("Not allowed", "NotAllowedError"))).toBe(
      "NFC permission was not granted. Please allow scanning on this device and try again.",
    );
    expect(normalizeNfcScannerError(new Error("permission denied"))).toBe(
      "NFC permission was not granted. Please allow scanning on this device and try again.",
    );
  });

  it("maps unsupported-device errors to a manual-entry message", () => {
    expect(normalizeNfcScannerError(new Error("NDEFReader is not available"))).toBe(
      "NFC scanning is not available on this device. Use manual entry instead.",
    );
  });
});
