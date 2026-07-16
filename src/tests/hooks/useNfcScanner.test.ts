import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeNfcScannerError, useNfcScanner } from "../../hooks/useNfcScanner";

const scanMock = vi.fn(async () => undefined);
const readers: MockNDEFReader[] = [];

class MockNDEFReader extends EventTarget {
  signal?: AbortSignal;

  constructor() {
    super();
    readers.push(this);
  }

  async scan(options?: { signal?: AbortSignal }) {
    this.signal = options?.signal;
    scanMock();
  }

  emitReading(value: string) {
    const data = new TextEncoder().encode(value);
    const event = new Event("reading") as Event & { message: NDEFMessage };
    event.message = {
        records: [{
          recordType: "text",
          encoding: "utf-8",
          data: new DataView(data.buffer),
        }],
      };
    this.dispatchEvent(event);
  }

  emitReadingError() {
    this.dispatchEvent(new Event("readingerror"));
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
    vi.useRealTimers();
    readers.length = 0;
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

  it("times out a hanging scan and returns to READY so later taps still work", async () => {
    vi.useFakeTimers();
    const onScan = vi.fn(() => new Promise<void>(() => undefined));
    const { result } = renderHook(() => useNfcScanner({ onScan, cooldownMs: 50, scanTimeoutMs: 100 }));

    await act(async () => {
      await result.current.startScanner();
    });

    act(() => {
      readers[0].emitReading("token-a");
    });

    expect(result.current.state).toBe("PROCESSING");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.state).toBe("ERROR");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });

    expect(result.current.state).toBe("READY");
    expect(onScan).toHaveBeenCalledTimes(1);
  });

  it("ignores duplicate taps only during cooldown", async () => {
    vi.useFakeTimers();
    const onScan = vi.fn(async () => undefined);
    const { result } = renderHook(() => useNfcScanner({ onScan, cooldownMs: 75, scanTimeoutMs: 500 }));

    await act(async () => {
      await result.current.startScanner();
    });

    await act(async () => {
      readers[0].emitReading("token-a");
      await Promise.resolve();
    });
    expect(result.current.state).toBe("SUCCESS");

    act(() => {
      readers[0].emitReading("token-b");
    });
    expect(onScan).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(80);
    });
    expect(result.current.state).toBe("READY");

    await act(async () => {
      readers[0].emitReading("token-c");
      await Promise.resolve();
    });

    expect(onScan).toHaveBeenCalledTimes(2);
  });

  it("restarts NFC after a reading error", async () => {
    vi.useFakeTimers();
    const onScan = vi.fn(async () => undefined);
    const { result } = renderHook(() => useNfcScanner({ onScan, cooldownMs: 50 }));

    await act(async () => {
      await result.current.startScanner();
    });

    act(() => {
      readers[0].emitReadingError();
    });

    expect(result.current.state).toBe("ERROR");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });

    expect(scanMock).toHaveBeenCalledTimes(2);
    expect(readers[0].signal?.aborted).toBe(true);
    expect(result.current.state).toBe("READY");
  });

  it("replaces stale scan sessions when the app resumes or reconnects", async () => {
    const onScan = vi.fn(async () => undefined);
    const { result } = renderHook(() => useNfcScanner({ onScan }));

    await act(async () => {
      await result.current.startScanner();
    });

    const firstSignal = readers[0].signal;

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(scanMock).toHaveBeenCalledTimes(2);
    expect(firstSignal?.aborted).toBe(true);
    expect(readers[1].signal?.aborted).toBe(false);

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    expect(scanMock).toHaveBeenCalledTimes(3);
    expect(readers[1].signal?.aborted).toBe(true);
  });
});
