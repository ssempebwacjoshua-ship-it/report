/**
 * Normalize any NFC scan value into a bare token/publicCode/UID.
 *
 * Accepts:
 *   SCNFC:<publicCode>
 *   schoolconnect:<publicCode>
 *   /t/<publicCode>
 *   /nfc/t/<publicCode>
 *   https://domain.com/t/<publicCode>
 *   https://domain.com/nfc/t/<publicCode>
 *   <raw publicCode or physical UID>
 */
export function normalizeNfcScanValue(raw: string): string {
  const clean = raw.trim();

  if (clean.toUpperCase().startsWith("SCNFC:")) {
    return clean.slice(6).trim();
  }

  if (clean.toLowerCase().startsWith("schoolconnect:")) {
    return clean.slice("schoolconnect:".length).trim();
  }

  const match = clean.match(/(?:\/nfc)?\/t\/([^/?#\s]+)/i);
  if (match) return decodeURIComponent(match[1] ?? "").trim();

  return clean;
}
