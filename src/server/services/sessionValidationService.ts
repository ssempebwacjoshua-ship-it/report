import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma";
import type { AuthPayload } from "./authService";

type SchoolSessionDb = Pick<PrismaClient, "user" | "school">;

export type ValidatedSchoolSession = {
  user: {
    id: string;
    schoolId: string;
    name: string;
    email: string;
    role: AuthPayload["role"];
    tokenVersion: number;
    isPlatformOwner: boolean;
  };
  school: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  };
  auth: AuthPayload;
};

export async function validateSchoolSession(
  payload: AuthPayload | null,
  db: SchoolSessionDb = defaultPrisma,
): Promise<ValidatedSchoolSession | null> {
  if (!payload?.userId || !payload.schoolId) {
    return null;
  }

  const userDelegate = (db as Partial<PrismaClient>).user as { findFirst?: (...args: any[]) => Promise<any> } | undefined;
  if (typeof userDelegate?.findFirst !== "function") {
    const schoolDelegate = (db as Partial<PrismaClient>).school as { findUnique?: (...args: any[]) => Promise<any> } | undefined;
    const schoolRecord = typeof schoolDelegate?.findUnique === "function"
      ? await schoolDelegate.findUnique({
          where: { id: payload.schoolId },
          select: { id: true, code: true, name: true, isActive: true },
        })
      : null;

    if (schoolRecord && schoolRecord.isActive === false) {
      return null;
    }

    if (typeof payload.tokenVersion !== "number") {
      return null;
    }

    const tokenVersion = payload.tokenVersion;
    return {
      user: {
        id: payload.userId,
        schoolId: payload.schoolId,
        name: payload.name,
        email: payload.email,
        role: payload.role,
        tokenVersion,
        isPlatformOwner: Boolean(payload.isPlatformOwner),
      },
      school: {
        id: schoolRecord?.id ?? payload.schoolId,
        code: schoolRecord?.code ?? payload.schoolId,
        name: schoolRecord?.name ?? "",
        isActive: schoolRecord?.isActive ?? true,
      },
      auth: {
        ...payload,
        tokenVersion,
      },
    };
  }

  const record = await userDelegate.findFirst({
    where: { id: payload.userId, schoolId: payload.schoolId },
    select: {
      id: true,
      schoolId: true,
      name: true,
      email: true,
      role: true,
      tokenVersion: true,
      isActive: true,
      isPlatformOwner: true,
      school: {
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
        },
      },
    },
  });

  if (!record?.isActive || !record.school?.isActive) {
    return null;
  }

  if (typeof payload.tokenVersion !== "number") {
    return null;
  }

  if (record.tokenVersion !== payload.tokenVersion) {
    return null;
  }

  return {
    user: {
      id: record.id,
      schoolId: record.schoolId,
      name: record.name,
      email: record.email,
      role: record.role as AuthPayload["role"],
      tokenVersion: record.tokenVersion,
      isPlatformOwner: record.isPlatformOwner,
    },
    school: {
      id: record.school.id,
      code: record.school.code,
      name: record.school.name,
      isActive: record.school.isActive,
    },
    auth: {
      userId: record.id,
      schoolId: record.schoolId,
      name: record.name,
      email: record.email,
      role: record.role as AuthPayload["role"],
      tokenVersion: record.tokenVersion,
      ...(record.isPlatformOwner ? { isPlatformOwner: true } : {}),
    },
  };
}
