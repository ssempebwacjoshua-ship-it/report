import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeNfcScanValue } from "../shared/utils/nfcPayload";

// Minimal Web NFC type stubs — not in standard lib.dom yet
declare global {
  class NDEFReader extends EventTarget {
    scan(options?: { signal?: AbortSignal }): Promise<void>;
    addEventListener(type: "reading", handler: (event: NDEFReadingEvent) => void): void;
    addEventListener(type: "readingerror", handler: (event: Event) => void): void;
  }
  interface NDEFReadingEvent extends Event {
    serialNumber: string;
    message: NDEFMessage;
  }
  interface NDEFMessage {
    records: NDEFRecord[];
  }
  interface NDEFRecord {
    recordType: string;
    mediaType?: string;
    id?: string;
    data?: DataView;
    encoding?: string;
    lang?: string;
  }
}

function getOrCreateDeviceId(): string {
  const key = "schoolconnect_nfc_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function extractRawValue(message: NDEFMessage): string {
  for (const record of message.records) {
    if ((record.recordType === "url" || record.recordType === "absolute-url" || record.recordType === "text") && record.data) {
      return new TextDecoder(record.encoding ?? "utf-8").decode(record.data);
    }
  }
  return "";
}

function describeNfcMessage(message: NDEFMessage): Array<{ recordType: string; mediaType?: string; hasData: boolean }> {
  return message.records.map((record) => ({
    recordType: record.recordType,
    mediaType: record.mediaType,
    hasData: !!record.data,
  }));
}

export function normalizeNfcScannerError(error: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "");
  if (/AbortError/i.test(message)) return "Scanner was cancelled.";
  if (/NotAllowedError|SecurityError|permission denied|not allowed|authori[sz]ed/i.test(message)) {
    return "NFC permission was not granted. Please allow scanning on this device and try again.";
  }
  if (/insecure context|secure context|https/i.test(message)) {
    return "NFC scanning requires a secure browser context on a supported device.";
  }
  if (/not found|unsupported|unavailable|not available|ndefreader/i.test(message)) {
    return "NFC scanning is not available on this device. Use manual entry instead.";
  }
  return error instanceof Error && error.message ? error.message : "Could not start NFC scanner.";
}

export type ScannerState =
  | "IDLE"
  | "PERMISSION"
  | "READY"
  | "READING"
  | "PROCESSING"
  | "SUCCESS"
  | "BLOCKED"
  | "ERROR";

export type ScanResult = {
  tokenOrUid: string;
  idempotencyKey: string;
  deviceId: string;
};

type UseNfcScannerOptions = {
  onScan: (result: ScanResult) => Promise<void>;
  cooldownMs?: number;
  scanTimeoutMs?: number;
};

const scannerLog = (message: string, details?: Record<string, unknown>) => {
  if (details) {
    console.info(`[nfc-scanner] ${message}`, details);
    return;
  }
  console.info(`[nfc-scanner] ${message}`);
};

export function useNfcScanner({ onScan, cooldownMs = 1500, scanTimeoutMs = 8000 }: UseNfcScannerOptions) {
  const [state, setState] = useState<ScannerState>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [deviceId] = useState(() => getOrCreateDeviceId());

  const stateRef = useRef<ScannerState>("IDLE");
  const abortRef = useRef<AbortController | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readerRef = useRef<NDEFReader | null>(null);
  const sessionRef = useRef(0);
  const processingRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const shouldScanRef = useRef(false);
  const restartScannerRef = useRef<() => void>(() => undefined);

  const isWebNfcAvailable = typeof window !== "undefined" && "NDEFReader" in window;

  const setStateSync = useCallback((s: ScannerState) => {
    stateRef.current = s;
    setState(s);
  }, []);

  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
    };
  }, []);

  const resetAfterCooldown = useCallback((sessionId?: number) => {
    if (cooldownRef.current) clearTimeout(cooldownRef.current);
    cooldownUntilRef.current = Date.now() + cooldownMs;
    cooldownRef.current = setTimeout(() => {
      if (sessionId && sessionId !== sessionRef.current) return;
      cooldownUntilRef.current = 0;
      setStateSync("READY");
      setError(null);
      scannerLog("scanner rearmed", { sessionId: sessionId ?? sessionRef.current });
    }, cooldownMs);
  }, [cooldownMs, setStateSync]);

  const runWithTimeout = useCallback((result: ScanResult) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`NFC scan request timed out after ${scanTimeoutMs}ms.`));
      }, scanTimeoutMs);
    });

    return Promise.race([onScan(result), timeoutPromise]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });
  }, [onScan, scanTimeoutMs]);

  const processRaw = useCallback(async (raw: string, sessionId = sessionRef.current) => {
    if (!raw.trim()) return;
    if (processingRef.current || Date.now() < cooldownUntilRef.current) return;

    const tokenOrUid = normalizeNfcScanValue(raw);
    const idempotencyKey = `${deviceId}-${Date.now()}-${tokenOrUid.slice(0, 20)}`;

    processingRef.current = true;
    setStateSync("PROCESSING");
    scannerLog("processing started", { sessionId });
    if (navigator.vibrate) navigator.vibrate([40]);

    try {
      await runWithTimeout({ tokenOrUid, idempotencyKey, deviceId });
      if (sessionId === sessionRef.current) setStateSync("SUCCESS");
    } catch (err) {
      scannerLog("timeout/error", { sessionId, error: err instanceof Error ? err.message : String(err) });
      const msg = err instanceof Error ? err.message : "Scan failed";
      setError(msg);
      const isBusinessBlock =
        msg.toLowerCase().includes("block") ||
        msg.toLowerCase().includes("frozen") ||
        msg.toLowerCase().includes("inactive") ||
        msg.toLowerCase().includes("insufficient");
      if (sessionId === sessionRef.current) setStateSync(isBusinessBlock ? "BLOCKED" : "ERROR");
    } finally {
      if (sessionId === sessionRef.current) {
        processingRef.current = false;
        resetAfterCooldown(sessionId);
      }
    }
  }, [deviceId, resetAfterCooldown, runWithTimeout, setStateSync]);

  const startScanner = useCallback(async () => {
    shouldScanRef.current = true;
    if (!isWebNfcAvailable) {
      setStateSync("IDLE");
      return;
    }

    const sessionId = sessionRef.current + 1;
    sessionRef.current = sessionId;
    processingRef.current = false;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setStateSync("PERMISSION");
    setError(null);
    scannerLog("session restarted", { sessionId });

    try {
      const reader = new NDEFReader();
      readerRef.current = reader;
      const signal = abortRef.current.signal;

      await reader.scan({ signal });
      if (sessionId !== sessionRef.current || signal.aborted) return;
      setStateSync("READY");
      scannerLog("scanner rearmed", { sessionId });

      reader.addEventListener("reading", ({ message, serialNumber }) => {
        if (sessionId !== sessionRef.current) return;
        scannerLog("scan received", {
          sessionId,
          serialNumber,
          records: describeNfcMessage(message),
        });
        if (processingRef.current || Date.now() < cooldownUntilRef.current) return;
        setStateSync("READING");
        const ndefPayload = extractRawValue(message);
        const raw = ndefPayload || serialNumber || "";
        if (!raw.trim()) {
          scannerLog("timeout/error", { sessionId, error: "NFC tag had no readable payload or serial number" });
          setError("NFC tag was detected but no readable ID was found.");
          setStateSync("ERROR");
          resetAfterCooldown(sessionId);
          return;
        }
        void processRaw(raw, sessionId);
      });

      reader.addEventListener("readingerror", () => {
        if (sessionId !== sessionRef.current) return;
        scannerLog("timeout/error", { sessionId, error: "NFC reading error" });
        setError("Could not read NFC tag. Try again.");
        setStateSync("ERROR");
        resetAfterCooldown();
        window.setTimeout(() => {
          if (shouldScanRef.current && sessionId === sessionRef.current) restartScannerRef.current();
        }, cooldownMs);
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      scannerLog("timeout/error", { sessionId, error: err instanceof Error ? err.message : String(err) });
      setError(normalizeNfcScannerError(err));
      setStateSync("ERROR");
      resetAfterCooldown(sessionId);
    }
  }, [cooldownMs, isWebNfcAvailable, processRaw, resetAfterCooldown, setStateSync]);

  useEffect(() => {
    restartScannerRef.current = () => {
      void startScanner();
    };
  }, [startScanner]);

  useEffect(() => {
    const restart = () => {
      if (!shouldScanRef.current || !isWebNfcAvailable) return;
      scannerLog("session restarted", { reason: "lifecycle" });
      void startScanner();
    };
    const restartWhenVisible = () => {
      if (document.visibilityState === "visible") restart();
    };
    window.addEventListener("focus", restart);
    window.addEventListener("pageshow", restart);
    window.addEventListener("online", restart);
    document.addEventListener("visibilitychange", restartWhenVisible);
    return () => {
      window.removeEventListener("focus", restart);
      window.removeEventListener("pageshow", restart);
      window.removeEventListener("online", restart);
      document.removeEventListener("visibilitychange", restartWhenVisible);
    };
  }, [isWebNfcAvailable, startScanner]);

  const stopScanner = useCallback(() => {
    shouldScanRef.current = false;
    sessionRef.current += 1;
    processingRef.current = false;
    readerRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    if (cooldownRef.current) clearTimeout(cooldownRef.current);
    cooldownUntilRef.current = 0;
    setStateSync("IDLE");
    setError(null);
  }, [setStateSync]);

  const submitManual = useCallback((raw: string) => {
    if (!raw.trim()) return;
    void processRaw(raw);
  }, [processRaw]);

  return {
    state,
    error,
    isOnline,
    isWebNfcAvailable,
    deviceId,
    startScanner,
    stopScanner,
    submitManual,
  };
}
