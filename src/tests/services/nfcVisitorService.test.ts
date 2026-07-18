import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveImageUpload: vi.fn(),
  deleteStoredUpload: vi.fn(),
}));

vi.mock("../../server/services/uploadStorageService", () => ({
  saveImageUpload: mocks.saveImageUpload,
  deleteStoredUpload: mocks.deleteStoredUpload,
}));

import {
  checkOutVisitor,
  getVisitorVisitDetail,
  listVisitorVisits,
  registerVisitor,
} from "../../server/services/nfcVisitorService";

const ADMIN_CTX = { schoolId: "school-a", actorId: "admin-a", role: "ADMIN_OPERATOR" as const };
const GATE_CTX = { schoolId: "school-a", actorId: "gate-a", role: "GATE_SECURITY" as const };

function createDb() {
  const visitors: Array<Record<string, any>> = [];
  const visits: Array<Record<string, any>> = [];
  const audits: Array<Record<string, any>> = [];
  const school = { id: "school-a", code: "SCU-PREVIEW" };

  const db = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
    school: {
      findUnique: async ({ where }: { where: { id: string } }) => where.id === "school-a" ? school : null,
    },
    visitor: {
      upsert: vi.fn(async ({ where, update, create }: { where: { schoolId_idDocumentType_idDocumentNumber: { schoolId: string; idDocumentType: string; idDocumentNumber: string } }; update: Record<string, unknown>; create: Record<string, unknown> }) => {
        const existingIndex = visitors.findIndex((row) =>
          row.schoolId === where.schoolId_idDocumentType_idDocumentNumber.schoolId
          && row.idDocumentType === where.schoolId_idDocumentType_idDocumentNumber.idDocumentType
          && row.idDocumentNumber === where.schoolId_idDocumentType_idDocumentNumber.idDocumentNumber);
        if (existingIndex >= 0) {
          visitors[existingIndex] = { ...visitors[existingIndex], ...update };
          return visitors[existingIndex];
        }
        const row = { createdAt: new Date("2026-07-18T10:00:00.000Z"), updatedAt: new Date("2026-07-18T10:00:00.000Z"), ...create };
        visitors.push(row);
        return row;
      }),
    },
    visitorVisit: {
      create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
        const visitor = visitors.find((row) => row.id === data.visitorId);
        const row = {
          createdAt: new Date("2026-07-18T10:30:00.000Z"),
          updatedAt: new Date("2026-07-18T10:30:00.000Z"),
          checkedOutAt: null,
          ...data,
          visitor,
        };
        visits.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where }: { where: Record<string, any> }) =>
        visits.filter((row) => {
          if (row.schoolId !== where.schoolId) return false;
          if (where.status && row.status !== where.status) return false;
          if (where.checkedOutAt?.not === null && row.checkedOutAt === null) return false;
          if (where.checkedOutAt === null && row.checkedOutAt !== null) return false;
          if (where.OR?.length) {
            const haystack = `${row.purpose} ${row.hostName} ${row.visitor?.fullName ?? ""} ${row.visitor?.idDocumentNumber ?? ""}`.toLowerCase();
            return where.OR.some((_: unknown) => haystack.includes(String(where.OR[0].purpose?.contains ?? where.OR[1]?.hostName?.contains ?? where.OR[2]?.visitor?.fullName?.contains ?? where.OR[3]?.visitor?.idDocumentNumber?.contains ?? "").toLowerCase()));
          }
          return true;
        })),
      findFirst: vi.fn(async ({ where }: { where: Record<string, any> }) =>
        visits.find((row) => row.id === where.id && row.schoolId === where.schoolId) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, any> }) => {
        const index = visits.findIndex((row) => row.id === where.id);
        visits[index] = { ...visits[index], ...data, updatedAt: new Date("2026-07-18T11:00:00.000Z") };
        return visits[index];
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
        audits.push(data);
        return {};
      }),
    },
  };

  return { db: db as never, visitors, visits, audits };
}

describe("nfcVisitorService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveImageUpload.mockResolvedValueOnce({
      publicUrl: "/api/private-uploads/visitors/id-document.webp",
      relativePath: "/api/private-uploads/visitors/id-document.webp",
      absolutePath: "/tmp/id-document.webp",
      mimeType: "image/webp",
      sizeBytes: 1200,
    }).mockResolvedValueOnce({
      publicUrl: "/api/private-uploads/visitors/selfie.webp",
      relativePath: "/api/private-uploads/visitors/selfie.webp",
      absolutePath: "/tmp/selfie.webp",
      mimeType: "image/webp",
      sizeBytes: 900,
    });
    mocks.deleteStoredUpload.mockResolvedValue(undefined);
  });

  it("registers a visitor immediately as checked in within the current school", async () => {
    const { db, visitors, visits } = createDb();

    const result = await registerVisitor(GATE_CTX, {
      fullName: "Grace Hopper",
      phone: "0774000001",
      idDocumentType: "PASSPORT",
      idDocumentNumber: "P1234567",
      purpose: "Meeting bursar",
      hostName: "Accounts office",
    }, {
      idDocumentImage: { buffer: Buffer.from("id"), originalname: "id.jpg", mimetype: "image/jpeg", size: 2 } as Express.Multer.File,
      selfieImage: { buffer: Buffer.from("selfie"), originalname: "selfie.jpg", mimetype: "image/jpeg", size: 6 } as Express.Multer.File,
    }, db);

    expect(result.visit.status).toBe("CHECKED_IN");
    expect(visitors).toHaveLength(1);
    expect(visits).toHaveLength(1);
    expect(visits[0]?.idDocumentImageUrl).toMatch(/id-document/);
    expect(visits[0]?.selfieImageUrl).toMatch(/selfie/);
  });

  it("lists current and historical visitor visits with school scoping", async () => {
    const { db, visitors, visits } = createDb();
    visitors.push({
      id: "visitor-1",
      schoolId: "school-a",
      fullName: "Grace Hopper",
      phone: "0774000001",
      idDocumentType: "PASSPORT",
      idDocumentNumber: "P1234567",
    });
    visits.push({
      id: "visit-1",
      schoolId: "school-a",
      visitorId: "visitor-1",
      status: "CHECKED_IN",
      purpose: "Meeting bursar",
      hostName: "Accounts office",
      checkedInAt: new Date("2026-07-18T09:00:00.000Z"),
      checkedOutAt: null,
      idDocumentImageUrl: "/api/private-uploads/visitors/id-document.webp",
      selfieImageUrl: "/api/private-uploads/visitors/selfie.webp",
      createdAt: new Date("2026-07-18T09:00:00.000Z"),
      updatedAt: new Date("2026-07-18T09:00:00.000Z"),
      visitor: visitors[0],
    });
    visits.push({
      id: "visit-2",
      schoolId: "school-a",
      visitorId: "visitor-1",
      status: "CHECKED_OUT",
      purpose: "Previous visit",
      hostName: "Head teacher",
      checkedInAt: new Date("2026-07-17T09:00:00.000Z"),
      checkedOutAt: new Date("2026-07-17T10:00:00.000Z"),
      idDocumentImageUrl: "/api/private-uploads/visitors/id-document.webp",
      selfieImageUrl: "/api/private-uploads/visitors/selfie.webp",
      createdAt: new Date("2026-07-17T09:00:00.000Z"),
      updatedAt: new Date("2026-07-17T10:00:00.000Z"),
      visitor: visitors[0],
    });

    const current = await listVisitorVisits(ADMIN_CTX, { status: "CURRENT" }, db);
    const history = await listVisitorVisits(ADMIN_CTX, { status: "HISTORY" }, db);
    const detail = await getVisitorVisitDetail(ADMIN_CTX, "visit-1", db);

    expect(current.visits).toHaveLength(1);
    expect(history.visits).toHaveLength(1);
    expect(detail.visit.id).toBe("visit-1");
  });

  it("checks out a currently checked-in visitor without duplicating checkout", async () => {
    const { db, visitors, visits } = createDb();
    visitors.push({
      id: "visitor-1",
      schoolId: "school-a",
      fullName: "Grace Hopper",
      phone: "0774000001",
      idDocumentType: "PASSPORT",
      idDocumentNumber: "P1234567",
    });
    visits.push({
      id: "visit-1",
      schoolId: "school-a",
      visitorId: "visitor-1",
      status: "CHECKED_IN",
      purpose: "Meeting bursar",
      hostName: "Accounts office",
      checkedInAt: new Date("2026-07-18T09:00:00.000Z"),
      checkedOutAt: null,
      idDocumentImageUrl: "/api/private-uploads/visitors/id-document.webp",
      selfieImageUrl: "/api/private-uploads/visitors/selfie.webp",
      createdAt: new Date("2026-07-18T09:00:00.000Z"),
      updatedAt: new Date("2026-07-18T09:00:00.000Z"),
      visitor: visitors[0],
    });

    const first = await checkOutVisitor(GATE_CTX, "visit-1", db);
    const second = await checkOutVisitor(GATE_CTX, "visit-1", db);

    expect(first.duplicate).toBe(false);
    expect(first.visit.status).toBe("CHECKED_OUT");
    expect(second.duplicate).toBe(true);
  });
});
