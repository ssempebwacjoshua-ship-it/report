import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import prismaPkg from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma";
import { hashPassword } from "./authService";
import { accountSetupTemplate, passwordChangedTemplate, passwordResetTemplate } from "./authEmailTemplates";
import { sendAuthEmail } from "./emailService";

const { AuthTokenType } = prismaPkg;
const ACCOUNT_SETUP_HOURS = 24;
const PASSWORD_RESET_MINUTES = 30;
const PASSWORD_MIN_LENGTH = 10;

export function createRawToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashAuthToken(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function authAppBaseUrl() {
  const value = process.env.APP_PUBLIC_URL?.trim() || process.env.APP_BASE_URL?.trim() || "http://localhost:5173";
  if (process.env.NODE_ENV === "production" && !value.startsWith("https://")) {
    throw Object.assign(new Error("APP_PUBLIC_URL must use HTTPS in production."), { status: 500 });
  }
  return value.replace(/\/+$/, "");
}

function tokenUrl(path: string, rawToken: string) {
  return `${authAppBaseUrl()}${path}?token=${encodeURIComponent(rawToken)}`;
}

function safeIp(ip?: string | null) {
  return ip?.slice(0, 128) || null;
}

function safeUa(ua?: string | null) {
  return ua?.slice(0, 512) || null;
}

function enforcePasswordPolicy(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw Object.assign(new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`), { status: 400, code: "PASSWORD_POLICY" });
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw Object.assign(new Error("Password must include letters and numbers."), { status: 400, code: "PASSWORD_POLICY" });
  }
}

type AuthTokenDb = Pick<PrismaClient, "authToken" | "user" | "school" | "auditLog" | "$transaction">;

export async function createAndSendAccountSetup(input: {
  userId: string;
  schoolId: string;
  inviterName: string;
  requestedIp?: string | null;
  requestedUserAgent?: string | null;
}, db: AuthTokenDb = defaultPrisma) {
  const rawToken = createRawToken();
  const tokenHash = hashAuthToken(rawToken);
  const expiresAt = new Date(Date.now() + ACCOUNT_SETUP_HOURS * 60 * 60 * 1000);

  const [user, school] = await Promise.all([
    db.user.findFirst({ where: { id: input.userId, schoolId: input.schoolId } }),
    db.school.findUnique({ where: { id: input.schoolId } }),
  ]);
  if (!user || !school) throw Object.assign(new Error("Staff user not found."), { status: 404 });

  const token = await db.authToken.create({
    data: {
      schoolId: input.schoolId,
      userId: input.userId,
      type: AuthTokenType.ACCOUNT_SETUP,
      tokenHash,
      expiresAt,
      requestedIp: safeIp(input.requestedIp),
      requestedUserAgent: safeUa(input.requestedUserAgent),
    },
  });

  const setupUrl = tokenUrl("/account/setup", rawToken);
  const template = accountSetupTemplate({
    recipientName: user.name,
    schoolName: school.name,
    inviterName: input.inviterName,
    setupUrl,
    expiresHours: ACCOUNT_SETUP_HOURS,
  });
  const result = await sendAuthEmail({ to: user.email, ...template });
  await db.authToken.update({
    where: { id: token.id },
    data: result.ok
      ? { resendMessageId: result.messageId, deliveryStatus: "SENT" }
      : { deliveryStatus: result.reason, deliveryErrorCode: result.safeErrorCode },
  });
  return { deliveryStatus: result.ok ? "SENT" : result.reason };
}

export async function requestPasswordReset(input: {
  email: string;
  requestedIp?: string | null;
  requestedUserAgent?: string | null;
}, db: AuthTokenDb = defaultPrisma) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const user = await db.user.findFirst({ where: { email: normalizedEmail, isActive: true }, include: { school: true } });
  if (!user) return { ok: true };

  const rawToken = createRawToken();
  const token = await db.authToken.create({
    data: {
      schoolId: user.schoolId,
      userId: user.id,
      type: AuthTokenType.PASSWORD_RESET,
      tokenHash: hashAuthToken(rawToken),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_MINUTES * 60 * 1000),
      requestedIp: safeIp(input.requestedIp),
      requestedUserAgent: safeUa(input.requestedUserAgent),
    },
  });
  const resetUrl = tokenUrl("/reset-password", rawToken);
  const template = passwordResetTemplate({ recipientName: user.name, resetUrl, expiresMinutes: PASSWORD_RESET_MINUTES });
  const result = await sendAuthEmail({ to: user.email, ...template });
  await db.authToken.update({
    where: { id: token.id },
    data: result.ok
      ? { resendMessageId: result.messageId, deliveryStatus: "SENT" }
      : { deliveryStatus: result.reason, deliveryErrorCode: result.safeErrorCode },
  });
  return { ok: true };
}

export async function consumeAccountSetup(rawToken: string, password: string, db: AuthTokenDb = defaultPrisma) {
  enforcePasswordPolicy(password);
  const tokenHash = hashAuthToken(rawToken);
  return db.$transaction(async (tx) => {
    const token = await tx.authToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!token || token.type !== AuthTokenType.ACCOUNT_SETUP) throw Object.assign(new Error("Invalid setup token."), { status: 400, code: "INVALID_TOKEN" });
    if (token.usedAt) throw Object.assign(new Error("Setup token has already been used."), { status: 400, code: "USED_TOKEN" });
    if (token.revokedAt) throw Object.assign(new Error("Setup token has been revoked."), { status: 400, code: "INVALID_TOKEN" });
    if (token.expiresAt <= new Date()) throw Object.assign(new Error("Setup token has expired."), { status: 400, code: "EXPIRED_TOKEN" });

    const passwordHash = await hashPassword(password);
    const user = await tx.user.update({
      where: { id: token.userId },
      data: { passwordHash, isActive: true, mustChangePassword: false, tokenVersion: { increment: 1 } },
    });
    await tx.authToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
    await tx.authToken.updateMany({
      where: { userId: token.userId, type: AuthTokenType.ACCOUNT_SETUP, usedAt: null, revokedAt: null, id: { not: token.id } },
      data: { revokedAt: new Date() },
    });
    await tx.auditLog.create({ data: { schoolId: token.schoolId, action: "AUTH_ACCOUNT_SETUP_COMPLETED", details: { targetUserId: token.userId } } });
    return { user: { id: user.id, email: user.email, name: user.name } };
  });
}

export async function resetPasswordWithToken(rawToken: string, password: string, db: AuthTokenDb = defaultPrisma) {
  enforcePasswordPolicy(password);
  const tokenHash = hashAuthToken(rawToken);
  const changedAt = new Date();
  const result = await db.$transaction(async (tx) => {
    const token = await tx.authToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!token || token.type !== AuthTokenType.PASSWORD_RESET) throw Object.assign(new Error("Invalid reset token."), { status: 400, code: "INVALID_TOKEN" });
    if (token.usedAt) throw Object.assign(new Error("Reset token has already been used."), { status: 400, code: "USED_TOKEN" });
    if (token.revokedAt) throw Object.assign(new Error("Reset token has been revoked."), { status: 400, code: "INVALID_TOKEN" });
    if (token.expiresAt <= changedAt) throw Object.assign(new Error("Reset token has expired."), { status: 400, code: "EXPIRED_TOKEN" });

    const passwordHash = await hashPassword(password);
    const user = await tx.user.update({
      where: { id: token.userId },
      data: { passwordHash, mustChangePassword: false, tokenVersion: { increment: 1 } },
    });
    await tx.authToken.update({ where: { id: token.id }, data: { usedAt: changedAt } });
    await tx.auditLog.create({ data: { schoolId: token.schoolId, action: "AUTH_PASSWORD_RESET_COMPLETED", details: { targetUserId: token.userId } } });
    return user;
  });

  const template = passwordChangedTemplate({ recipientName: result.name, changedAt });
  void sendAuthEmail({ to: result.email, ...template });
  return { ok: true };
}

export const AUTH_TOKEN_EXPIRY = {
  accountSetupHours: ACCOUNT_SETUP_HOURS,
  passwordResetMinutes: PASSWORD_RESET_MINUTES,
};

