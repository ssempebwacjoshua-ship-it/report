function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function assertLocalPinFormat(pin: string): void {
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error("PIN must be 4 to 6 digits.");
  }
}

export async function verifyLocalWalletPin(pin: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const iterations = Number.parseInt(parts[1] ?? "0", 10);
  const saltHex = parts[2] ?? "";
  const expectedHex = parts[3] ?? "";
  if (!iterations || !saltHex || !expectedHex) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-512", salt: new TextEncoder().encode(saltHex), iterations },
    key,
    (expectedHex.length / 2) * 8,
  );

  return bytesToHex(new Uint8Array(derived)) === expectedHex;
}
