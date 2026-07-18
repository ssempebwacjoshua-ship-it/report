import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma";
import { hasPermission } from "../../shared/permissions";
import { deleteStoredUpload, saveImageUpload } from "./uploadStorageService";

type Db = Pick<
  PrismaClient,
  | "school"
  | "visitor"
  | "visitorVisit"
  | "auditLog"
> & {
  $transaction?: <T>(fn: (tx: Db) => Promise<T>) => Promise<T>;
};

type UploadFile = Pick<Express.Multer.File, "buffer" | "originalname" | "mimetype" | "size">;

export type NfcVisitorContext = {
  schoolId?: string | null;
  actorId?: string | null;
  role?: string | null;
};

export type RegisterVisitorInput = {
  fullName: string;
  phone?: string | null;
  idDocumentType: string;
  idDocumentNumber: string;
  purpose: string;
  hostName: string;
};

export type RegisterVisitorFiles = {
  idDocumentImage: UploadFile;
  selfieImage: UploadFile;
};

export type VisitorListFilters = {
  status?: "CURRENT" | "HISTORY" | "ALL";
  search?: string;
};

function requireSchoolId(ctx: NfcVisitorContext): string {
  if (!ctx.schoolId) throw Object.assign(new Error("School context required."), { status: 401 });
  return ctx.schoolId;
}

function requireGatePermission(ctx: NfcVisitorContext) {
  if (!ctx.actorId || !ctx.role) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (!hasPermission(ctx.role, "nfc.gate.scan")) {
    throw Object.assign(new Error("You do not have permission for this action."), { status: 403 });
  }
}

function requireViewPermission(ctx: NfcVisitorContext) {
  if (!ctx.actorId || !ctx.role) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (!(hasPermission(ctx.role, "nfc.gate.view") || hasPermission(ctx.role, "app.admin"))) {
    throw Object.assign(new Error("You do not have permission for this action."), { status: 403 });
  }
}

function runWrite<T>(db: Db, fn: (tx: Db) => Promise<T>) {
  return db.$transaction ? db.$transaction(fn) : fn(db);
}

function normalizeText(value: string | null | undefined, field: string) {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    throw Object.assign(new Error(`${field} is required.`), { status: 400 });
  }
  return normalized;
}

function formatVisitRow(visit: {
  id: string;
  status: string;
  purpose: string;
  hostName: string;
  checkedInAt: Date;
  checkedOutAt: Date | null;
  idDocumentImageUrl: string | null;
  selfieImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  visitor: {
    id: string;
    fullName: string;
    phone: string | null;
    idDocumentType: string;
    idDocumentNumber: string;
  };
}) {
  return {
    id: visit.id,
    status: visit.status,
    purpose: visit.purpose,
    hostName: visit.hostName,
    checkedInAt: visit.checkedInAt.toISOString(),
    checkedOutAt: visit.checkedOutAt?.toISOString() ?? null,
    idDocumentImageUrl: visit.idDocumentImageUrl,
    selfieImageUrl: visit.selfieImageUrl,
    createdAt: visit.createdAt.toISOString(),
    updatedAt: visit.updatedAt.toISOString(),
    visitor: {
      id: visit.visitor.id,
      fullName: visit.visitor.fullName,
      phone: visit.visitor.phone,
      idDocumentType: visit.visitor.idDocumentType,
      idDocumentNumber: visit.visitor.idDocumentNumber,
    },
  };
}

export async function registerVisitor(
  ctx: NfcVisitorContext,
  input: RegisterVisitorInput,
  files: RegisterVisitorFiles,
  db: Db = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireGatePermission(ctx);
  const school = await db.school.findUnique({
    where: { id: schoolId },
    select: { id: true, code: true },
  });
  if (!school) throw Object.assign(new Error("School not found."), { status: 404 });

  const fullName = normalizeText(input.fullName, "Visitor name");
  const idDocumentType = normalizeText(input.idDocumentType, "ID/passport type");
  const idDocumentNumber = normalizeText(input.idDocumentNumber, "ID/passport number");
  const purpose = normalizeText(input.purpose, "Visit purpose");
  const hostName = normalizeText(input.hostName, "Host or person visiting");
  const phone = input.phone?.trim() || null;
  const visitorId = randomUUID();
  const visitId = randomUUID();

  let idDocumentImageUrl: string | null = null;
  let selfieImageUrl: string | null = null;
  try {
    const uploadedId = await saveImageUpload({
      buffer: files.idDocumentImage.buffer,
      originalName: files.idDocumentImage.originalname,
      mimeType: files.idDocumentImage.mimetype,
      relativeDirParts: ["visitors", school.code, visitorId, visitId],
      prefix: "id-document",
      privateAccess: true,
    });
    idDocumentImageUrl = uploadedId.publicUrl;

    const uploadedSelfie = await saveImageUpload({
      buffer: files.selfieImage.buffer,
      originalName: files.selfieImage.originalname,
      mimeType: files.selfieImage.mimetype,
      relativeDirParts: ["visitors", school.code, visitorId, visitId],
      prefix: "selfie",
      privateAccess: true,
    });
    selfieImageUrl = uploadedSelfie.publicUrl;

    const visit = await runWrite(db, async (tx) => {
      const visitor = await tx.visitor.upsert({
        where: {
          schoolId_idDocumentType_idDocumentNumber: {
            schoolId,
            idDocumentType,
            idDocumentNumber,
          },
        },
        update: {
          fullName,
          phone,
        },
        create: {
          id: visitorId,
          schoolId,
          fullName,
          phone,
          idDocumentType,
          idDocumentNumber,
        },
      });

      const createdVisit = await tx.visitorVisit.create({
        data: {
          id: visitId,
          schoolId,
          visitorId: visitor.id,
          status: "CHECKED_IN",
          purpose,
          hostName,
          checkedInAt: new Date(),
          idDocumentImageUrl,
          selfieImageUrl,
          createdByUserId: ctx.actorId ?? null,
        },
        include: {
          visitor: true,
        },
      });

      await tx.auditLog.create({
        data: {
          schoolId,
          action: "visitor.registered",
          details: {
            actor: { id: ctx.actorId ?? null },
            visitorId: visitor.id,
            visitorVisitId: createdVisit.id,
            hostName,
          },
        },
      });
      return createdVisit;
    });

    return { visit: formatVisitRow(visit) };
  } catch (error) {
    await Promise.allSettled([
      deleteStoredUpload(idDocumentImageUrl),
      deleteStoredUpload(selfieImageUrl),
    ]);
    throw error;
  }
}

export async function listVisitorVisits(
  ctx: NfcVisitorContext,
  filters: VisitorListFilters = {},
  db: Db = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireViewPermission(ctx);
  const search = filters.search?.trim();

  const visits = await db.visitorVisit.findMany({
    where: {
      schoolId,
      ...(filters.status === "CURRENT"
        ? { status: "CHECKED_IN", checkedOutAt: null }
        : filters.status === "HISTORY"
          ? { checkedOutAt: { not: null } }
          : {}),
      ...(search
        ? {
            OR: [
              { purpose: { contains: search, mode: "insensitive" } },
              { hostName: { contains: search, mode: "insensitive" } },
              {
                visitor: {
                  fullName: { contains: search, mode: "insensitive" },
                },
              },
              {
                visitor: {
                  idDocumentNumber: { contains: search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      visitor: true,
    },
    orderBy: [{ checkedOutAt: "asc" }, { checkedInAt: "desc" }],
    take: 200,
  });

  return { visits: visits.map(formatVisitRow) };
}

export async function getVisitorVisitDetail(
  ctx: NfcVisitorContext,
  visitId: string,
  db: Db = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireViewPermission(ctx);
  const visit = await db.visitorVisit.findFirst({
    where: { id: visitId, schoolId },
    include: { visitor: true },
  });
  if (!visit) throw Object.assign(new Error("Visitor visit not found."), { status: 404 });
  return { visit: formatVisitRow(visit) };
}

export async function checkOutVisitor(
  ctx: NfcVisitorContext,
  visitId: string,
  db: Db = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireGatePermission(ctx);
  const visit = await db.visitorVisit.findFirst({
    where: { id: visitId, schoolId },
    include: { visitor: true },
  });
  if (!visit) throw Object.assign(new Error("Visitor visit not found."), { status: 404 });
  if (visit.checkedOutAt) {
    return { visit: formatVisitRow(visit), duplicate: true as const };
  }

  const updated = await runWrite(db, async (tx) => {
    const checkedOut = await tx.visitorVisit.update({
      where: { id: visit.id },
      data: {
        status: "CHECKED_OUT",
        checkedOutAt: new Date(),
        checkedOutByUserId: ctx.actorId ?? null,
      },
      include: { visitor: true },
    });
    await tx.auditLog.create({
      data: {
        schoolId,
        action: "visitor.checked_out",
        details: {
          actor: { id: ctx.actorId ?? null },
          visitorId: checkedOut.visitorId,
          visitorVisitId: checkedOut.id,
        },
      },
    });
    return checkedOut;
  });

  return { visit: formatVisitRow(updated), duplicate: false as const };
}
