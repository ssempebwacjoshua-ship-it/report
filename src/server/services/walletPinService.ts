import { pbkdf2, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const pbkdf2Async = promisify(pbkdf2);

const ITERATIONS = 100_000;
const SALT_BYTES = 32;
const HASH_BYTES = 64;
const DIGEST = "sha512";
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1_000; // 15 minutes

export function assertPinFormat(pin: string): void {
  if (!/^\d{4,6}$/.test(pin)) {
    throw Object.assign(new Error("PIN must be 4 to 6 digits."), { status: 400 });
  }
}

// Stored format: pbkdf2$<iterations>$<saltHex>$<hashHex>
export async function hashWalletPin(pin: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const hash = await pbkdf2Async(pin, salt, ITERATIONS, HASH_BYTES, DIGEST);
  return `pbkdf2$${ITERATIONS}$${salt}$${hash.toString("hex")}`;
}

export async function verifyWalletPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[1] ?? "0", 10);
  const salt = parts[2] ?? "";
  const expectedHex = parts[3] ?? "";
  if (!iterations || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = await pbkdf2Async(pin, salt, iterations, expected.length, DIGEST);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export type WalletForPinCheck = {
  id: string;
  pinHash: string | null;
  pinFailedAttempts: number;
  pinLockedUntil: Date | null;
};

export type PinCheckResult =
  | { ok: true }
  | { ok: false; reason: "no_pin" | "locked" | "wrong_pin"; pinLockedUntil?: Date };

// Returns structured result — caller is responsible for DB updates and audit logging.
export async function checkPin(wallet: WalletForPinCheck, pin: string): Promise<PinCheckResult> {
  if (!wallet.pinHash) return { ok: false, reason: "no_pin" };
  if (wallet.pinLockedUntil && wallet.pinLockedUntil > new Date()) {
    return { ok: false, reason: "locked", pinLockedUntil: wallet.pinLockedUntil };
  }
  const ok = await verifyWalletPin(pin, wallet.pinHash);
  if (!ok) {
    const newAttempts = wallet.pinFailedAttempts + 1;
    const locked = newAttempts >= MAX_FAILED_ATTEMPTS;
    return {
      ok: false,
      reason: "wrong_pin",
      pinLockedUntil: locked ? new Date(Date.now() + LOCK_DURATION_MS) : undefined,
    };
  }
  return { ok: true };
}
