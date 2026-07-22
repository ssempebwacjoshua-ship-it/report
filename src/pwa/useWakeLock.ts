import { useCallback, useEffect, useRef, useState } from "react";

type WakeLockSentinelLike = EventTarget & {
  released?: boolean;
  release?: () => Promise<void>;
  addEventListener?: (type: "release", listener: () => void) => void;
  removeEventListener?: (type: "release", listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request?: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

type UseWakeLockOptions = {
  enabled?: boolean;
};

export function useWakeLock({ enabled = true }: UseWakeLockOptions = {}) {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const releaseWakeLock = useCallback(async () => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    if (!sentinel?.release) {
      setIsActive(false);
      return;
    }

    try {
      await sentinel.release();
    } catch {
      // Ignore release errors; the browser may already have released it.
    } finally {
      setIsActive(false);
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (!enabled || typeof window === "undefined") return;

    const wakeLock = (navigator as WakeLockNavigator).wakeLock;
    const request = wakeLock?.request;
    const supported = typeof request === "function";
    setIsSupported(supported);
    if (!supported) return;

    try {
      const sentinel = await request.call(wakeLock, "screen");
      sentinelRef.current = sentinel;
      setIsActive(true);
      setError(null);

      const onRelease = () => {
        setIsActive(false);
      };

      sentinel.addEventListener?.("release", onRelease);
    } catch (wakeLockError) {
      setIsActive(false);
      setError(
        wakeLockError instanceof Error
          ? wakeLockError.message
          : "Could not keep the screen awake on this device.",
      );
    }
  }, [enabled]);

  useEffect(() => {
    setIsSupported(typeof (navigator as WakeLockNavigator).wakeLock?.request === "function");
  }, []);

  useEffect(() => {
    if (!enabled) {
      void releaseWakeLock();
      return;
    }

    void requestWakeLock();

    const reRequestOnVisible = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", reRequestOnVisible);
    window.addEventListener("focus", reRequestOnVisible);

    return () => {
      document.removeEventListener("visibilitychange", reRequestOnVisible);
      window.removeEventListener("focus", reRequestOnVisible);
      void releaseWakeLock();
    };
  }, [enabled, releaseWakeLock, requestWakeLock]);

  return {
    isSupported,
    isActive,
    error,
    requestWakeLock,
    releaseWakeLock,
  };
}
