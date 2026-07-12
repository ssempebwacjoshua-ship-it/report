import { Prisma, UserRole } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { prisma as defaultPrisma } from "../db/prisma";
import { hashPassword } from "./authService";
import { createAndSendAccountSetup } from "./authTokenService";

type StaffContext = {
  schoolId?: string | null;
  actorId?: string | null;
  role?: string | null;
};

const MANAGEABLE_ROLES: UserRole[] = [
  UserRole.ADMIN_OPERATOR,
  UserRole.GATE_SECURITY,
  UserRole.SECURITY,
  UserRole.CANTEEN,
  UserRole.CASHIER,
];
const TEMP_PASSWORD_MIN_LENGTH = 10;

function requireSchoolAdmin(ctx: StaffContext): string {
  if (!ctx.schoolId) throw Object.assign(new Error("School context required."), { status: 401 });
  if (!ctx.actorId || !ctx.role) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (ctx.role !== "ADMIN_OPERATOR" && !ctx.role?.includes("OWNER") && ctx.role !== "SUPER_ADMIN") {
    throw Object.assign(new Error("Only administrators can manage staff accounts."), { status: 403 });
  }
  return ctx.schoolId;
}

function safeUser(user: { id: string; name: string; email: string; role: UserRole; isActive: boolean; mustChangePassword: boolean; lastLoginAt: Date | null; createdAt: Date }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    invitationStatus: user.isActive ? "ACCOUNT_ACTIVE" : "INVITATION_PENDING",
  };
}

function auditLog(db: Pick<PrismaClient, "auditLog">, schoolId: string, action: string, details: Record<string, unknown>) {
  return db.auditLog.create({ data: { schoolId, action, details: details as Prisma.InputJsonValue } });
}

export async function listStaffUsers(ctx: StaffContext, db: Pick<PrismaClient, "user"> = defaultPrisma) {
  const schoolId = requireSchoolAdmin(ctx);
  const users = await db.user.findMany({
    where: { schoolId, role: { in: MANAGEABLE_ROLES } },
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
  });
  return { users: users.map(safeUser) };
}

export async function createStaffUser(
  ctx: StaffContext,
  input: { name: string; email: string; phone?: string; role: string },
  db: Pick<PrismaClient, "user" | "school" | "authToken" | "auditLog"> = defaultPrisma,
) {
  const schoolId = requireSchoolAdmin(ctx);

  if (!MANAGEABLE_ROLES.includes(input.role as UserRole)) {
    throw Object.assign(new Error(`Invalid role: ${input.role}. Allowed: ${MANAGEABLE_ROLES.join(", ")}`), { status: 400 });
  }
  if (!input.name.trim()) throw Object.assign(new Error("Name is required."), { status: 400 });
  if (!input.email.trim()) throw Object.assign(new Error("Email is required."), { status: 400 });

  const normalizedEmail = input.email.toLowerCase().trim();
  const existing = await db.user.findFirst({ where: { schoolId, email: normalizedEmail } });
  if (existing) throw Object.assign(new Error("A user with this email already exists in this school."), { status: 409 });

  const passwordHash = await hashPassword(createPlaceholderPassword());
  const user = await db.user.create({
    data: {
      schoolId,
      name: input.name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: input.role as UserRole,
      isActive: false,
      mustChangePassword: true,
      tokenVersion: 0,
    },
  });

  const delivery = await createAndSendAccountSetup({
    userId: user.id,
    schoolId,
    inviterName: ctx.actorId ? "your school administrator" : "SSAMENJ",
  }, db as never);

  void auditLog(db, schoolId, "STAFF_USER_CREATED", {
    actorId: ctx.actorId,
    targetUserId: user.id,
    role: user.role,
    email: user.email,
    invitationDeliveryStatus: delivery.deliveryStatus,
  });

  return { user: safeUser(user), invitationDeliveryStatus: delivery.deliveryStatus };
}

function createPlaceholderPassword() {
  return `Pending-${cryptoRandom()}-Setup1`;
}

function cryptoRandom() {
  return crypto.randomBytes(16).toString("hex");
}

export async function changeStaffRole(
  ctx: StaffContext,
  userId: string,
  input: { role: string; reason: string },
  db: Pick<PrismaClient, "user" | "auditLog"> = defaultPrisma,
) {
  const schoolId = requireSchoolAdmin(ctx);

  if (!MANAGEABLE_ROLES.includes(input.role as UserRole)) {
    throw Object.assign(new Error(`Invalid role: ${input.role}`), { status: 400 });
  }
  if (!input.reason.trim()) throw Object.assign(new Error("Reason is required."), { status: 400 });

  const target = await db.user.findFirst({ where: { id: userId, schoolId } });
  if (!target) throw Object.assign(new Error("Staff user not found."), { status: 404 });

  if (target.role === UserRole.ADMIN_OPERATOR && input.role !== "ADMIN_OPERATOR") {
    const adminCount = await db.user.count({ where: { schoolId, role: UserRole.ADMIN_OPERATOR, isActive: true } });
    if (adminCount <= 1) throw Object.assign(new Error("Cannot remove the last administrator from this school."), { status: 400 });
  }

  const oldRole = target.role;
  const updated = await db.user.update({
    where: { id: userId },
    data: { role: input.role as UserRole, tokenVersion: { increment: 1 } },
  });

  void auditLog(db, schoolId, "STAFF_ROLE_CHANGED", {
    actorId: ctx.actorId,
    targetUserId: userId,
    oldRole,
    newRole: input.role,
    reason: input.reason,
  });

  return { user: safeUser(updated), requiresRelogin: userId === ctx.actorId };
}

export async function setStaffStatus(
  ctx: StaffContext,
  userId: string,
  input: { isActive: boolean; reason: string },
  db: Pick<PrismaClient, "user" | "auditLog"> = defaultPrisma,
) {
  const schoolId = requireSchoolAdmin(ctx);
  if (!input.reason.trim()) throw Object.assign(new Error("Reason is required."), { status: 400 });
  if (ctx.actorId === userId) throw Object.assign(new Error("You cannot change your own active status."), { status: 400 });

  const target = await db.user.findFirst({ where: { id: userId, schoolId } });
  if (!target) throw Object.assign(new Error("Staff user not found."), { status: 404 });

  if (!input.isActive && target.role === UserRole.ADMIN_OPERATOR) {
    const adminCount = await db.user.count({ where: { schoolId, role: UserRole.ADMIN_OPERATOR, isActive: true } });
    if (adminCount <= 1) throw Object.assign(new Error("Cannot disable the last administrator."), { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: {
      isActive: input.isActive,
      tokenVersion: input.isActive ? undefined : { increment: 1 },
    },
  });

  void auditLog(db, schoolId, input.isActive ? "STAFF_USER_ENABLED" : "STAFF_USER_DISABLED", {
    actorId: ctx.actorId,
    targetUserId: userId,
    reason: input.reason,
  });

  return { user: safeUser(updated) };
}

export async function resetStaffPassword(
  ctx: StaffContext,
  userId: string,
  input: { temporaryPassword: string; reason: string },
  db: Pick<PrismaClient, "user" | "auditLog"> = defaultPrisma,
) {
  const schoolId = requireSchoolAdmin(ctx);
  if (!input.temporaryPassword || input.temporaryPassword.length < TEMP_PASSWORD_MIN_LENGTH) {
    throw Object.assign(new Error(`Temporary password must be at least ${TEMP_PASSWORD_MIN_LENGTH} characters.`), { status: 400 });
  }
  if (!input.reason.trim()) throw Object.assign(new Error("Reason is required."), { status: 400 });

  const target = await db.user.findFirst({ where: { id: userId, schoolId } });
  if (!target) throw Object.assign(new Error("Staff user not found."), { status: 404 });

  const passwordHash = await hashPassword(input.temporaryPassword);
  const updated = await db.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: true, tokenVersion: { increment: 1 } },
  });

  void auditLog(db, schoolId, "STAFF_PASSWORD_RESET", {
    actorId: ctx.actorId,
    targetUserId: userId,
    reason: input.reason,
  });

  return { user: safeUser(updated) };
}

export async function resendStaffInvitation(
  ctx: StaffContext,
  userId: string,
  db: Pick<PrismaClient, "user" | "school" | "authToken" | "auditLog"> = defaultPrisma,
) {
  const schoolId = requireSchoolAdmin(ctx);
  const target = await db.user.findFirst({ where: { id: userId, schoolId } });
  if (!target) throw Object.assign(new Error("Staff user not found."), { status: 404 });
  if (target.isActive && !target.mustChangePassword) {
    throw Object.assign(new Error("This account is already active."), { status: 400 });
  }
  const delivery = await createAndSendAccountSetup({
    userId,
    schoolId,
    inviterName: "your school administrator",
  }, db as never);
  void auditLog(db, schoolId, "STAFF_INVITATION_RESENT", {
    actorId: ctx.actorId,
    targetUserId: userId,
    invitationDeliveryStatus: delivery.deliveryStatus,
  });
  return { invitationDeliveryStatus: delivery.deliveryStatus };
}
