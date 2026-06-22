import { useState } from "react";
import type { ScannerState } from "../../hooks/useNfcScanner";

type Props = {
  state: ScannerState;
  error: string | null;
  isOnline: boolean;
  isWebNfcAvailable: boolean;
  onStart: () => void;
  onStop: () => void;
  onManualSubmit: (value: string) => void;
  scanLabel?: string;
  className?: string;
};

const STATE_CONFIG: Record<ScannerState, { label: string; color: string }> = {
  IDLE:       { label: "Scanner off",       color: "text-gray-500" },
  PERMISSION: { label: "Waiting for permission…", color: "text-yellow-600" },
  READY:      { label: "Ready — tap tag",   color: "text-blue-600" },
  READING:    { label: "Reading tag…",      color: "text-blue-700" },
  PROCESSING: { label: "Processing…",       color: "text-blue-700" },
  SUCCESS:    { label: "Scan successful",   color: "text-green-600" },
  BLOCKED:    { label: "Scan blocked",      color: "text-red-600" },
  ERROR:      { label: "Scan error",        color: "text-red-600" },
};

const active = (s: ScannerState) =>
  s !== "IDLE" && s !== "ERROR";

export function NfcScanPanel({
  state,
  error,
  isOnline,
  isWebNfcAvailable,
  onStart,
  onStop,
  onManualSubmit,
  scanLabel = "Start Scanner",
  className = "",
}: Props) {
  const [manual, setManual] = useState("");
  const cfg = STATE_CONFIG[state];
  const scanning = active(state);

  return (
    <div className={`rounded-xl border bg-white shadow-sm ${className}`}>
      {/* Offline banner */}
      {!isOnline && (
        <div className="rounded-t-xl bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 font-medium">
          No internet connection — scanning disabled
        </div>
      )}

      {/* Scanner area */}
      <div className="p-5 flex flex-col items-center gap-4">
        {/* NFC icon */}
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
            state === "SUCCESS"
              ? "bg-green-100"
              : state === "BLOCKED" || state === "ERROR"
                ? "bg-red-100"
                : state === "READY" || state === "READING" || state === "PROCESSING"
                  ? "bg-blue-100 animate-pulse"
                  : "bg-gray-100"
          }`}
        >
          {state === "SUCCESS" ? (
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : state === "BLOCKED" || state === "ERROR" ? (
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : state === "PROCESSING" || state === "READING" ? (
            <svg className="w-10 h-10 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
            </svg>
          )}
        </div>

        {/* Status label */}
        <p className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</p>

        {/* Error message */}
        {error && (state === "ERROR" || state === "BLOCKED") && (
          <p className="text-xs text-red-500 text-center max-w-xs">{error}</p>
        )}

        {/* Action button */}
        {!scanning || state === "ERROR" || state === "BLOCKED" || state === "SUCCESS" ? (
          <button
            onClick={isWebNfcAvailable && isOnline ? onStart : undefined}
            disabled={!isOnline}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              !isOnline
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {scanLabel}
          </button>
        ) : (
          <button
            onClick={onStop}
            className="px-5 py-2.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            Stop Scanner
          </button>
        )}

        {/* Web NFC unavailable notice */}
        {!isWebNfcAvailable && (
          <p className="text-xs text-gray-400 text-center">
            NFC scanning requires Android Chrome. Use manual input below.
          </p>
        )}
      </div>

      {/* Manual input fallback */}
      <div className="border-t px-5 py-4">
        <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Manual entry</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && manual.trim()) {
                onManualSubmit(manual.trim());
                setManual("");
              }
            }}
            placeholder="Scan token or UID…"
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={() => {
              if (manual.trim()) {
                onManualSubmit(manual.trim());
                setManual("");
              }
            }}
            disabled={!manual.trim() || state === "PROCESSING"}
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium transition-colors"
          >
            Go
          </button>
        </div>
      </div>
    </div>
  );
}
