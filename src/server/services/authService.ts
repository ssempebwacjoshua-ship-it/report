import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
const JWT_EXPIRES_IN = "7d";

export type SchoolUserRole = "ADMIN_OPERATOR" | "TEACHER" | "CASHIER" | "CANTEEN" | "SECURITY" | "GATE_SECURITY";

export type AuthPayload = {
  userId: string;
  schoolId: string;
  name: string;
  email: string;
  role: SchoolUserRole;
  isPlatformOwner?: boolean;
  tokenVersion?: number;
};

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeSchoolCode(schoolCode: string): string {
  return schoolCode.trim().toUpperCase();
}

export function isSupportedPasswordHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value.trim());
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  if (!password.trim()) {
    throw new Error("Password input cannot be empty.");
  }
  if (isSupportedPasswordHash(password)) {
    throw new Error("Password input already looks hashed and cannot be re-hashed.");
  }
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!plain.trim()) return false;
  if (!isSupportedPasswordHash(hash)) return false;
  return bcrypt.compare(plain, hash);
}

