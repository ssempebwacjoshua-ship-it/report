import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import prismaPkg from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma";
import { hashPassword, normalizeLoginEmail, normalizeSchoolCode, verifyPassword } from "./authService";
import { accountSetupTemplate, passwordChangedTemplate, passwordResetOtpTemplate } from "./authEmailTemplates";
import { sendAuthEmail } from "./emailService";

const { AuthTokenType } = prismaPkg;
const ACCOUNT_SETUP_HOURS = 24;
const PASSWORD_RESET_MINUTES = 15;
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_RESET_OTP_LENGTH = 6;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_RESEND_COOLDOWN_MS = 60_000;

export function createRawToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashAuthToken(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function authAppBaseUrl() {
  const value = process.env.APP_PUBLIC_URL?.trim()
    || process.env.PUBLIC_APP_URL?.trim()
    || process.env.APP_URL?.trim()
    || process.env.APP_BASE_URL?.trim()
    || "http://localhost:5173";
  if (process.env.NODE_ENV === "production" && !value.startsWith("https://")) {
    throw Object.assign(new Error("Public auth app URL must use HTTPS in production."), { status: 500 });
  }
  return value.replace(/\/+$/, "");
}

function buildAuthUrl(path: string, query?: Record<string, string | undefined | null>) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) params.set(key, value);
  }
  const search = params.toString();
  return `${authAppBaseUrl()}${normalizedPath}${search ? `?${search}` : ""}`;
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

function createNumericOtp(length: number) {
  const max = 10 ** length;
  return crypto.randomInt(0, max).toString().padStart(length, "0");
}

async function hashOtp(otp: string) {
  return hashPassword(otp);
}

async function findPasswordResetUser(db: AuthTokenDb, schoolCode: string, email: string) {
  const normalizedSchoolCode = normalizeSchoolCode(schoolCode);
  const normalizedEmail = normalizeLoginEmail(email);
  if (!normalizedSchoolCode) return null;
  const school = await db.school.findUnique({ where: { code: normalizedSchoolCode } });
  if (!school || !school.isActive) return null;
  const user = await db.user.findFirst({
    where: {
      schoolId: school.id,
      email: normalizedEmail,
      isActive: true,
    },
  });
  if (!user) return null;
  return { school, user, normalizedSchoolCode, normalizedEmail };
}

async function findAccountSetupUser(db: AuthTokenDb, schoolCode: string, email: string) {
  const normalizedSchoolCode = normalizeSchoolCode(schoolCode);
  const normalizedEmail = normalizeLoginEmail(email);
  if (!normalizedSchoolCode) return null;
  const school = await db.school.findUnique({ where: { code: normalizedSchoolCode } });
  if (!school || !school.isActive) return null;
  const user = await db.user.findFirst({
    where: {
      schoolId: school.id,
      email: normalizedEmail,
    },
  });
  if (!user) return null;
  if (user.isActive && !user.mustChangePassword) return null;
  return { school, user, normalizedSchoolCode, normalizedEmail };
}

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
  const setupCode = createNumericOtp(PASSWORD_RESET_OTP_LENGTH);

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
      setupCodeHash: await hashOtp(setupCode),
      expiresAt,
      requestedIp: safeIp(input.requestedIp),
      requestedUserAgent: safeUa(input.requestedUserAgent),
    },
  });

  const setupUrl = buildAuthUrl("/account/setup", {
    token: rawToken,
    schoolCode: school.code,
    email: user.email,
  });
  const template = accountSetupTemplate({
    recipientName: user.name,
    schoolName: school.name,
    inviterName: input.inviterName,
    setupUrl,
    setupCode,
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
  schoolCode: string;
  email: string;
  requestedIp?: string | null;
  requestedUserAgent?: string | null;
}, db: AuthTokenDb = defaultPrisma) {
  const match = await findPasswordResetUser(db, input.schoolCode, input.email);
  if (!match) return { ok: true, cooldownSeconds: 0 };

  const activeToken = await db.authToken.findFirst({
    where: {
      schoolId: match.school.id,
      userId: match.user.id,
      type: AuthTokenType.PASSWORD_RESET,
      usedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (activeToken && Date.now() - activeToken.createdAt.getTime() < PASSWORD_RESET_RESEND_COOLDOWN_MS) {
    return { ok: true, cooldownSeconds: Math.ceil((PASSWORD_RESET_RESEND_COOLDOWN_MS - (Date.now() - activeToken.createdAt.getTime())) / 1000) };
  }

  await db.authToken.updateMany({
    where: {
      schoolId: match.school.id,
      userId: match.user.id,
      type: AuthTokenType.PASSWORD_RESET,
      usedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  const otp = createNumericOtp(PASSWORD_RESET_OTP_LENGTH);
  const token = await db.authToken.create({
    data: {
      schoolId: match.user.schoolId,
      userId: match.user.id,
      type: AuthTokenType.PASSWORD_RESET,
      tokenHash: await hashOtp(otp),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_MINUTES * 60 * 1000),
      requestedIp: safeIp(input.requestedIp),
      requestedUserAgent: safeUa(input.requestedUserAgent),
    },
  });
  const template = passwordResetOtpTemplate({
    recipientName: match.user.name,
    otp,
    resetUrl: buildAuthUrl("/reset-password", {
      schoolCode: match.normalizedSchoolCode,
      email: match.normalizedEmail,
    }),
    expiresMinutes: PASSWORD_RESET_MINUTES,
  });
  const result = await sendAuthEmail({ to: match.user.email, ...template });
  await db.authToken.update({
    where: { id: token.id },
    data: result.ok
      ? { resendMessageId: result.messageId, deliveryStatus: "SENT" }
      : { deliveryStatus: result.reason, deliveryErrorCode: result.safeErrorCode },
  });
  return { ok: true, cooldownSeconds: PASSWORD_RESET_RESEND_COOLDOWN_MS / 1000 };
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

export async function resetPasswordWithOtp(input: { schoolCode: string; email: string; otp: string; password: string }, db: AuthTokenDb = defaultPrisma) {
  enforcePasswordPolicy(input.password);
  const match = await findPasswordResetUser(db, input.schoolCode, input.email);
  if (!match) throw Object.assign(new Error("Invalid or expired reset code."), { status: 400, code: "INVALID_OTP" });
  const changedAt = new Date();
  const result = await db.$transaction(async (tx) => {
    const token = await tx.authToken.findFirst({
      where: {
        schoolId: match.school.id,
        userId: match.user.id,
        type: AuthTokenType.PASSWORD_RESET,
        usedAt: null,
        revokedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!token) throw Object.assign(new Error("Invalid or expired reset code."), { status: 400, code: "INVALID_OTP" });
    if (token.expiresAt <= changedAt) {
      await tx.authToken.update({ where: { id: token.id }, data: { revokedAt: changedAt } });
      throw Object.assign(new Error("Invalid or expired reset code."), { status: 400, code: "EXPIRED_OTP" });
    }
    const matched = await verifyPassword(input.otp, token.tokenHash);
    if (!matched) {
      const nextAttempts = token.attemptCount + 1;
      await tx.authToken.update({
        where: { id: token.id },
        data: {
          attemptCount: nextAttempts,
          ...(nextAttempts >= PASSWORD_RESET_MAX_ATTEMPTS ? { revokedAt: changedAt } : {}),
        },
      });
      throw Object.assign(new Error(nextAttempts >= PASSWORD_RESET_MAX_ATTEMPTS ? "Reset code locked due to too many attempts." : "Invalid or expired reset code."), {
        status: 400,
        code: nextAttempts >= PASSWORD_RESET_MAX_ATTEMPTS ? "OTP_LOCKED" : "INVALID_OTP",
      });
    }

    const passwordHash = await hashPassword(input.password);
    const user = await tx.user.update({
      where: { id: token.userId },
      data: { passwordHash, mustChangePassword: false, tokenVersion: { increment: 1 } },
    });
    await tx.authToken.update({ where: { id: token.id }, data: { usedAt: changedAt } });
    await tx.authToken.updateMany({
      where: { userId: token.userId, type: AuthTokenType.PASSWORD_RESET, usedAt: null, revokedAt: null, id: { not: token.id } },
      data: { revokedAt: changedAt },
    });
    await tx.auditLog.create({ data: { schoolId: token.schoolId, action: "AUTH_PASSWORD_RESET_COMPLETED", details: { targetUserId: token.userId } } });
    return user;
  });

  const template = passwordChangedTemplate({ recipientName: result.name, changedAt });
  void sendAuthEmail({ to: result.email, ...template });
  return { ok: true };
}

export async function consumeAccountSetupWithOtp(input: { schoolCode: string; email: string; otp: string; password: string }, db: AuthTokenDb = defaultPrisma) {
  enforcePasswordPolicy(input.password);
  const match = await findAccountSetupUser(db, input.schoolCode, input.email);
  if (!match) throw Object.assign(new Error("Invalid or expired setup code."), { status: 400, code: "INVALID_OTP" });
  const changedAt = new Date();
  const result = await db.$transaction(async (tx) => {
    const token = await tx.authToken.findFirst({
      where: {
        schoolId: match.school.id,
        userId: match.user.id,
        type: AuthTokenType.ACCOUNT_SETUP,
        usedAt: null,
        revokedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!token) throw Object.assign(new Error("Invalid or expired setup code."), { status: 400, code: "INVALID_OTP" });
    if (token.expiresAt <= changedAt) {
      await tx.authToken.update({ where: { id: token.id }, data: { revokedAt: changedAt } });
      throw Object.assign(new Error("Invalid or expired setup code."), { status: 400, code: "EXPIRED_OTP" });
    }
    if (!token.setupCodeHash) {
      throw Object.assign(new Error("Invalid or expired setup code."), { status: 400, code: "INVALID_OTP" });
    }
    const matched = await verifyPassword(input.otp, token.setupCodeHash);
    if (!matched) {
      const nextAttempts = token.attemptCount + 1;
      await tx.authToken.update({
        where: { id: token.id },
        data: {
          attemptCount: nextAttempts,
          ...(nextAttempts >= PASSWORD_RESET_MAX_ATTEMPTS ? { revokedAt: changedAt } : {}),
        },
      });
      throw Object.assign(new Error(nextAttempts >= PASSWORD_RESET_MAX_ATTEMPTS ? "Setup code locked due to too many attempts." : "Invalid or expired setup code."), {
        status: 400,
        code: nextAttempts >= PASSWORD_RESET_MAX_ATTEMPTS ? "OTP_LOCKED" : "INVALID_OTP",
      });
    }

    const passwordHash = await hashPassword(input.password);
    const user = await tx.user.update({
      where: { id: token.userId },
      data: { passwordHash, isActive: true, mustChangePassword: false, tokenVersion: { increment: 1 } },
    });
    await tx.authToken.update({ where: { id: token.id }, data: { usedAt: changedAt } });
    await tx.authToken.updateMany({
      where: { userId: token.userId, type: AuthTokenType.ACCOUNT_SETUP, usedAt: null, revokedAt: null, id: { not: token.id } },
      data: { revokedAt: changedAt },
    });
    await tx.auditLog.create({ data: { schoolId: token.schoolId, action: "AUTH_ACCOUNT_SETUP_COMPLETED", details: { targetUserId: token.userId } } });
    return user;
  });

  const template = passwordChangedTemplate({ recipientName: result.name, changedAt });
  void sendAuthEmail({ to: result.email, ...template });
  return { ok: true };
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
  passwordResetOtpLength: PASSWORD_RESET_OTP_LENGTH,
  passwordResetMaxAttempts: PASSWORD_RESET_MAX_ATTEMPTS,
  passwordResetResendCooldownSeconds: PASSWORD_RESET_RESEND_COOLDOWN_MS / 1000,
};
