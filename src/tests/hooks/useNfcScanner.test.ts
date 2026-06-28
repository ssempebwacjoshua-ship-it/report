import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeNfcScannerError, useNfcScanner } from "../../hooks/useNfcScanner";

const scanMock = vi.fn(async () => undefined);

class MockNDEFReader extends EventTarget {
  async scan() {
    scanMock();
  }
}

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
}

describe("normalizeNfcScannerError", () => {
  beforeEach(() => {
    scanMock.mockClear();
    setNavigatorOnline(true);
    Object.defineProperty(window, "NDEFReader", {
      configurable: true,
      value: MockNDEFReader,
    });
  });

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

  it("can start NFC scanning while navigator.onLine is false", async () => {
    setNavigatorOnline(false);
    const onScan = vi.fn(async () => undefined);
    const { result } = renderHook(() => useNfcScanner({ onScan }));

    await act(async () => {
      await result.current.startScanner();
    });

    await waitFor(() => expect(result.current.state).toBe("READY"));
    expect(scanMock).toHaveBeenCalled();
    expect(result.current.error).not.toBe("Online connection required for NFC scanning.");
  });
});
