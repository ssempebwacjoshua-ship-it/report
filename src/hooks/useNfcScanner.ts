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
};

export function useNfcScanner({ onScan, cooldownMs = 1500 }: UseNfcScannerOptions) {
  const [state, setState] = useState<ScannerState>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  const deviceId = useRef(getOrCreateDeviceId());
  const stateRef = useRef<ScannerState>("IDLE");
  const readerRef = useRef<NDEFReader | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const shouldScanRef = useRef(false);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      shouldScanRef.current = false;
      abortRef.current?.abort();
      readerRef.current = null;
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
    };
  }, []);

  const resetAfterCooldown = useCallback(() => {
    if (cooldownRef.current) clearTimeout(cooldownRef.current);
    cooldownRef.current = setTimeout(() => {
      setStateSync("READY");
      setError(null);
    }, cooldownMs);
  }, [cooldownMs, setStateSync]);

  const processRaw = useCallback(async (raw: string) => {
    if (!raw.trim()) return;

    const tokenOrUid = normalizeNfcScanValue(raw);
    const idempotencyKey = `${deviceId.current}-${Date.now()}-${tokenOrUid.slice(0, 20)}`;

    setStateSync("PROCESSING");
    if (navigator.vibrate) navigator.vibrate([40]);

    try {
      await onScan({ tokenOrUid, idempotencyKey, deviceId: deviceId.current });
      setStateSync("SUCCESS");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      setError(msg);
      const isBusinessBlock =
        msg.toLowerCase().includes("block") ||
        msg.toLowerCase().includes("frozen") ||
        msg.toLowerCase().includes("inactive") ||
        msg.toLowerCase().includes("insufficient");
      setStateSync(isBusinessBlock ? "BLOCKED" : "ERROR");
    }

    resetAfterCooldown();
  }, [onScan, resetAfterCooldown, setStateSync]);

  const startScanner = useCallback(async () => {
    if (!isWebNfcAvailable) {
      shouldScanRef.current = false;
      setStateSync("IDLE");
      return;
    }

    shouldScanRef.current = true;
    setStateSync("PERMISSION");
    setError(null);

    try {
      const reader = new NDEFReader();
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      readerRef.current = reader;

      await reader.scan({ signal: abortRef.current.signal });
      setStateSync("READY");

      reader.addEventListener("reading", ({ message }) => {
        const current = stateRef.current;
        if (current === "PROCESSING" || current === "SUCCESS" || current === "BLOCKED" || current === "ERROR") return;
        setStateSync("READING");
        const raw = extractRawValue(message);
        if (raw) void processRaw(raw);
      });

      reader.addEventListener("readingerror", () => {
        setError("Could not read NFC tag. Try again.");
        setStateSync("ERROR");
        resetAfterCooldown();
      });
    } catch (err) {
      readerRef.current = null;
      if (err instanceof Error && err.name === "AbortError") return;
      setError(normalizeNfcScannerError(err));
      setStateSync("ERROR");
    }
  }, [isWebNfcAvailable, processRaw, resetAfterCooldown, setStateSync]);

  const stopScanner = useCallback(() => {
    shouldScanRef.current = false;
    abortRef.current?.abort();
    abortRef.current = null;
    readerRef.current = null;
    if (cooldownRef.current) clearTimeout(cooldownRef.current);
    setStateSync("IDLE");
    setError(null);
  }, [setStateSync]);

  useEffect(() => {
    const suspendScanner = () => {
      if (document.visibilityState !== "hidden" || !shouldScanRef.current) return;
      abortRef.current?.abort();
      abortRef.current = null;
      readerRef.current = null;
    };

    const resumeScanner = () => {
      if (
        document.visibilityState === "visible" &&
        shouldScanRef.current &&
        (!readerRef.current || !abortRef.current || abortRef.current.signal.aborted)
      ) {
        void startScanner();
      }
    };

    document.addEventListener("visibilitychange", suspendScanner);
    document.addEventListener("visibilitychange", resumeScanner);
    window.addEventListener("pageshow", resumeScanner);
    window.addEventListener("focus", resumeScanner);

    return () => {
      document.removeEventListener("visibilitychange", suspendScanner);
      document.removeEventListener("visibilitychange", resumeScanner);
      window.removeEventListener("pageshow", resumeScanner);
      window.removeEventListener("focus", resumeScanner);
    };
  }, [startScanner]);

  const submitManual = useCallback((raw: string) => {
    if (!raw.trim()) return;
    void processRaw(raw);
  }, [processRaw]);

  return {
    state,
    error,
    isOnline,
    isWebNfcAvailable,
    deviceId: deviceId.current,
    startScanner,
    stopScanner,
    submitManual,
  };
}
