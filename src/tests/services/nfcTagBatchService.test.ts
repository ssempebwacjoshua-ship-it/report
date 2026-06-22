import { describe, expect, it } from "vitest";
import {
  amendTag,
  bulkAllocateFromInventory,
  bulkImportUids,
  createUrlTagBatch,
  listTagBatches,
  listTagInventory,
  verifyTag,
} from "../../server/services/nfcTagBatchService";

// ─── Minimal mock DB ──────────────────────────────────────────────────────────

type MockTag = {
  id: string;
  schoolId: string;
  batchId: string | null;
  publicCode: string;
  physicalUid: string | null;
  tagMode: string;
  label: string | null;
  type: string;
  purpose: string;
  status: string;
  studentId: string | null;
  writtenUrl: string | null;
  issuedAt: Date | null;
  writtenAt: Date | null;
  verifiedAt: Date | null;
  assignedAt: Date | null;
  lastSeenAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MockBatch = {
  id: string;
  schoolId: string;
  name: string;
  tagMode: string;
  quantity: number;
  status: string;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MockStudent = { id: string; schoolId: string; isActive: boolean };
type MockCredential = {
  id: string;
  schoolId: string;
  studentId: string;
  type: string;
  credentialUID: string;
  status: string;
  issuedAt: Date;
  deactivatedAt: Date | null;
  deactivatedReason: string | null;
  scanToken: string | null;
  issuedById: string | null;
};

let tagId = 0;
let batchId = 0;
let credId = 0;

function makeTag(partial: Partial<MockTag> & { schoolId: string }): MockTag {
  return {
    id: `tag-${++tagId}`,
    batchId: null,
    publicCode: `code-${tagId}`,
    physicalUid: null,
    tagMode: "URL",
    label: null,
    type: "STUDENT",
    purpose: "STUDENT",
    status: "GENERATED",
    studentId: null,
    writtenUrl: null,
    issuedAt: null,
    writtenAt: null,
    verifiedAt: null,
    assignedAt: null,
    lastSeenAt: null,
    createdById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

function createMockDb(options: {
  tags?: MockTag[];
  batches?: MockBatch[];
  students?: MockStudent[];
  credentials?: MockCredential[];
} = {}) {
  const tags: MockTag[] = [...(options.tags ?? [])];
  const batches: MockBatch[] = [...(options.batches ?? [])];
  const students: MockStudent[] = [...(options.students ?? [])];
  const credentials: MockCredential[] = [...(options.credentials ?? [])];
  const auditLogs: unknown[] = [];

  const db = {
    nfcTagBatch: {
      create: async ({ data }: { data: Partial<MockBatch> }) => {
        const b: MockBatch = {
          id: `batch-${++batchId}`,
          schoolId: data.schoolId ?? "",
          name: data.name ?? "",
          tagMode: data.tagMode ?? "URL",
          quantity: data.quantity ?? 0,
          status: data.status ?? "ACTIVE",
          createdById: data.createdById ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        batches.push(b);
        return b;
      },
      findMany: async ({ where }: { where: { schoolId?: string; tagMode?: string } }) => {
        const filtered = batches.filter(
          (b) =>
            (!where.schoolId || b.schoolId === where.schoolId) &&
            (!where.tagMode || b.tagMode === where.tagMode),
        );
        return filtered.map((b) => ({
          ...b,
          _count: { tags: tags.filter((t) => t.batchId === b.id).length },
          tags: tags.filter((t) => t.batchId === b.id).map((t) => ({ status: t.status })),
        }));
      },
    },
    nfcTag: {
      create: async ({ data }: { data: Partial<MockTag> }) => {
        const t = makeTag({ schoolId: data.schoolId ?? "", ...data });
        tags.push(t);
        return { ...t, student: null };
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        return tags
          .filter((t) => {
            if (where.schoolId && t.schoolId !== where.schoolId) return false;
            if (where.batchId && t.batchId !== where.batchId) return false;
            if (where.tagMode && t.tagMode !== where.tagMode) return false;
            const statusFilter = where.status as { in?: string[] } | string | undefined;
            if (statusFilter) {
              if (typeof statusFilter === "object" && statusFilter.in) {
                if (!statusFilter.in.includes(t.status)) return false;
              } else if (typeof statusFilter === "string" && t.status !== statusFilter) {
                return false;
              }
            }
            // physicalUid filter
            const uidFilter = where.physicalUid as { in?: string[] } | string | undefined;
            if (uidFilter) {
              if (typeof uidFilter === "object" && uidFilter.in) {
                if (!uidFilter.in.includes(t.physicalUid ?? "")) return false;
              } else if (typeof uidFilter === "string" && t.physicalUid !== uidFilter) {
                return false;
              }
            }
            return true;
          })
          .map((t) => ({ ...t, student: null }));
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const found = tags.find((t) => {
          if (where.id && t.id !== where.id) return false;
          if (where.schoolId && t.schoolId !== where.schoolId) return false;
          if (where.physicalUid && t.physicalUid !== where.physicalUid) return false;
          const idNotFilter = (where.id as { not?: string } | undefined);
          if (idNotFilter?.not && t.id === idNotFilter.not) return false;
          return true;
        });
        return found ? { ...found, student: null } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<MockTag> }) => {
        const idx = tags.findIndex((t) => t.id === where.id);
        if (idx < 0) throw new Error("tag not found");
        tags[idx] = { ...tags[idx], ...data, updatedAt: new Date() };
        const stu = students.find((s) => s.id === tags[idx].studentId) ?? null;
        return {
          ...tags[idx],
          student: stu
            ? { id: stu.id, firstName: "Test", lastName: "Student", admissionNumber: "A001", enrollments: [] }
            : null,
        };
      },
    },
    student: {
      findFirst: async ({ where }: { where: { id?: string; schoolId?: string; isActive?: boolean } }) => {
        return (
          students.find(
            (s) =>
              (!where.id || s.id === where.id) &&
              (!where.schoolId || s.schoolId === where.schoolId) &&
              (where.isActive === undefined || s.isActive === where.isActive),
          ) ?? null
        );
      },
    },
    studentCredential: {
      findFirst: async ({ where }: { where: { schoolId?: string; studentId?: string; type?: string; status?: string; credentialUID?: string } }) => {
        return (
          credentials.find(
            (c) =>
              (!where.schoolId || c.schoolId === where.schoolId) &&
              (!where.studentId || c.studentId === where.studentId) &&
              (!where.type || c.type === where.type) &&
              (!where.status || c.status === where.status) &&
              (!where.credentialUID || c.credentialUID === where.credentialUID),
          ) ?? null
        );
      },
      create: async ({ data }: { data: Partial<MockCredential> }) => {
        const c: MockCredential = {
          id: `cred-${++credId}`,
          schoolId: data.schoolId ?? "",
          studentId: data.studentId ?? "",
          type: data.type ?? "NFC_WRISTBAND",
          credentialUID: data.credentialUID ?? "",
          status: data.status ?? "ACTIVE",
          issuedAt: data.issuedAt ?? new Date(),
          deactivatedAt: null,
          deactivatedReason: null,
          scanToken: data.scanToken ?? null,
          issuedById: data.issuedById ?? null,
        };
        credentials.push(c);
        return c;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<MockCredential> }) => {
        const idx = credentials.findIndex((c) => c.id === where.id);
        if (idx < 0) throw new Error("credential not found");
        credentials[idx] = { ...credentials[idx], ...data };
        return credentials[idx];
      },
    },
    auditLog: {
      create: async ({ data }: { data: unknown }) => { auditLogs.push(data); return data; },
    },
  };

  return { db: db as never, tags, batches, credentials, auditLogs };
}

const CTX = { schoolId: "school-a", actorId: "admin-1", role: "ADMIN_OPERATOR" };
const BASE = "https://app.example.com";

// ─── createUrlTagBatch ────────────────────────────────────────────────────────

describe("createUrlTagBatch", () => {
  it("creates a batch and the requested number of URL tags", async () => {
    const { db, tags, batches, auditLogs } = createMockDb();
    const result = await createUrlTagBatch(CTX, { name: "S1 Batch", quantity: 3, baseUrl: BASE }, db);

    expect(result.generated).toBe(3);
    expect(tags).toHaveLength(3);
    expect(batches).toHaveLength(1);
    expect(result.batch.tagMode).toBe("URL");
    expect(tags.every((t) => t.tagMode === "URL")).toBe(true);
    expect(tags.every((t) => t.writtenUrl?.startsWith(BASE + "/t/"))).toBe(true);
    expect(auditLogs.some((l: unknown) => (l as { action: string }).action === "nfc_tag.batch_created")).toBe(true);
  });

  it("applies label prefix", async () => {
    const { db, tags } = createMockDb();
    await createUrlTagBatch(CTX, { name: "Batch", quantity: 2, labelPrefix: "S1-EW", baseUrl: BASE }, db);
    expect(tags[0].label).toBe("S1-EW-0001");
    expect(tags[1].label).toBe("S1-EW-0002");
  });

  it("rejects quantity > 500", async () => {
    const { db } = createMockDb();
    await expect(
      createUrlTagBatch(CTX, { name: "Big", quantity: 501, baseUrl: BASE }, db),
    ).rejects.toMatchObject({ message: "Quantity must be between 1 and 500.", status: 400 });
  });

  it("requires batch name", async () => {
    const { db } = createMockDb();
    await expect(
      createUrlTagBatch(CTX, { name: "  ", quantity: 1, baseUrl: BASE }, db),
    ).rejects.toMatchObject({ status: 400 });
  });
});

// ─── bulkImportUids ───────────────────────────────────────────────────────────

describe("bulkImportUids", () => {
  it("creates a batch and REGISTERED UID tags", async () => {
    const { db, tags, batches } = createMockDb();
    const result = await bulkImportUids(CTX, { batchName: "S1 Wristbands", uids: ["WB01", "WB02"] }, db);

    expect(result.registered).toBe(2);
    expect(batches).toHaveLength(1);
    expect(batches[0].tagMode).toBe("UID");
    expect(tags.every((t) => t.tagMode === "UID")).toBe(true);
    expect(tags.every((t) => t.status === "REGISTERED")).toBe(true);
    expect(tags.map((t) => t.physicalUid)).toEqual(["WB01", "WB02"]);
  });

  it("normalizes UIDs to uppercase", async () => {
    const { db, tags } = createMockDb();
    await bulkImportUids(CTX, { batchName: "B", uids: [" wb01 ", "wb02"] }, db);
    expect(tags.map((t) => t.physicalUid)).toEqual(["WB01", "WB02"]);
  });

  it("rejects duplicate UIDs in the same request", async () => {
    const { db } = createMockDb();
    await expect(
      bulkImportUids(CTX, { batchName: "B", uids: ["WB01", "WB01"] }, db),
    ).rejects.toMatchObject({ message: "Duplicate UID in request: WB01", status: 400 });
  });

  it("rejects UID that looks like a URL", async () => {
    const { db } = createMockDb();
    await expect(
      bulkImportUids(CTX, { batchName: "B", uids: ["https://example.com/nfc"] }, db),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects UIDs that already exist in the school inventory", async () => {
    const existingTag = makeTag({ schoolId: "school-a", physicalUid: "WB01", tagMode: "UID" });
    const { db } = createMockDb({ tags: [existingTag] });
    await expect(
      bulkImportUids(CTX, { batchName: "B", uids: ["WB01"] }, db),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("requires batch name", async () => {
    const { db } = createMockDb();
    await expect(
      bulkImportUids(CTX, { batchName: "  ", uids: ["WB01"] }, db),
    ).rejects.toMatchObject({ status: 400 });
  });
});

// ─── listTagBatches ───────────────────────────────────────────────────────────

describe("listTagBatches", () => {
  it("returns batch list with status counts", async () => {
    const { db } = createMockDb();
    await createUrlTagBatch(CTX, { name: "S1 URL", quantity: 2, baseUrl: BASE }, db);
    await bulkImportUids(CTX, { batchName: "S1 UID", uids: ["WB01"] }, db);

    const result = await listTagBatches(CTX, {}, db);
    expect(result.batches).toHaveLength(2);
  });

  it("filters by tagMode", async () => {
    const { db } = createMockDb();
    await createUrlTagBatch(CTX, { name: "URL batch", quantity: 1, baseUrl: BASE }, db);
    await bulkImportUids(CTX, { batchName: "UID batch", uids: ["WB01"] }, db);

    const uid = await listTagBatches(CTX, { tagMode: "UID" }, db);
    expect(uid.batches).toHaveLength(1);
    expect(uid.batches[0].tagMode).toBe("UID");
  });
});

// ─── listTagInventory ─────────────────────────────────────────────────────────

describe("listTagInventory", () => {
  it("lists all tags for the school", async () => {
    const { db } = createMockDb();
    await createUrlTagBatch(CTX, { name: "B", quantity: 3, baseUrl: BASE }, db);
    const result = await listTagInventory(CTX, {}, db);
    expect(result.total).toBe(3);
  });

  it("filters by UNALLOCATED (includes GENERATED/REGISTERED)", async () => {
    const { db } = createMockDb();
    await createUrlTagBatch(CTX, { name: "URL B", quantity: 2, baseUrl: BASE }, db);
    await bulkImportUids(CTX, { batchName: "UID B", uids: ["WB01"] }, db);

    const result = await listTagInventory(CTX, { status: "UNALLOCATED" }, db);
    expect(result.total).toBe(3); // GENERATED and REGISTERED are both unallocated
  });
});

// ─── verifyTag ────────────────────────────────────────────────────────────────

describe("verifyTag", () => {
  it("sets status to VERIFIED and records verifiedAt", async () => {
    const tag = makeTag({ schoolId: "school-a", tagMode: "UID", physicalUid: "WB01", status: "REGISTERED" });
    const { db, tags } = createMockDb({ tags: [tag] });

    const result = await verifyTag(CTX, tag.id, db);
    expect(result.status).toBe("VERIFIED");
    expect(tags[0].verifiedAt).toBeTruthy();
  });

  it("rejects an already-ASSIGNED tag", async () => {
    const tag = makeTag({ schoolId: "school-a", status: "ASSIGNED" });
    const { db } = createMockDb({ tags: [tag] });
    await expect(verifyTag(CTX, tag.id, db)).rejects.toMatchObject({ status: 409 });
  });

  it("returns 404 for tag in wrong school", async () => {
    const tag = makeTag({ schoolId: "school-b" });
    const { db } = createMockDb({ tags: [tag] });
    await expect(verifyTag(CTX, tag.id, db)).rejects.toMatchObject({ status: 404 });
  });
});

// ─── amendTag ────────────────────────────────────────────────────────────────

describe("amendTag", () => {
  it("amends label and records audit", async () => {
    const tag = makeTag({ schoolId: "school-a", tagMode: "UID", physicalUid: "WB01", status: "REGISTERED" });
    const { db, auditLogs } = createMockDb({ tags: [tag] });

    const result = await amendTag(CTX, tag.id, { label: "Class A Tag", reason: "Mislabelled" }, db);
    expect(result.label).toBe("Class A Tag");
    expect(auditLogs.some((l: unknown) => (l as { action: string }).action === "nfc_tag.amended")).toBe(true);
  });

  it("rejects amending physicalUid to a URL", async () => {
    const tag = makeTag({ schoolId: "school-a", tagMode: "UID", physicalUid: "WB01" });
    const { db } = createMockDb({ tags: [tag] });
    await expect(
      amendTag(CTX, tag.id, { physicalUid: "https://example.com", reason: "test" }, db),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("requires reason", async () => {
    const tag = makeTag({ schoolId: "school-a" });
    const { db } = createMockDb({ tags: [tag] });
    await expect(
      amendTag(CTX, tag.id, { label: "X", reason: " " }, db),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("requires at least one field to amend", async () => {
    const tag = makeTag({ schoolId: "school-a" });
    const { db } = createMockDb({ tags: [tag] });
    await expect(amendTag(CTX, tag.id, { reason: "test" }, db)).rejects.toMatchObject({ status: 400 });
  });
});

// ─── bulkAllocateFromInventory ────────────────────────────────────────────────

describe("bulkAllocateFromInventory", () => {
  it("allocates UID tags to students and creates StudentCredential", async () => {
    const tag = makeTag({ schoolId: "school-a", tagMode: "UID", physicalUid: "WB01", status: "REGISTERED" });
    const student: MockStudent = { id: "stu-1", schoolId: "school-a", isActive: true };
    const { db, tags, credentials, auditLogs } = createMockDb({ tags: [tag], students: [student] });

    const result = await bulkAllocateFromInventory(
      CTX,
      { assignments: [{ tagId: tag.id, studentId: student.id }], reason: "Class day" },
      db,
    );

    expect(result.tags).toHaveLength(1);
    expect(result.credentialCount).toBe(1);
    expect(tags[0].status).toBe("ASSIGNED");
    expect(tags[0].studentId).toBe(student.id);
    expect(credentials).toHaveLength(1);
    expect(credentials[0].credentialUID).toBe("WB01");
    expect(auditLogs.some((l: unknown) => (l as { action: string }).action === "nfc_tag.allocated")).toBe(true);
  });

  it("rejects allocation of a DISABLED tag", async () => {
    const tag = makeTag({ schoolId: "school-a", tagMode: "UID", physicalUid: "WB01", status: "DISABLED" });
    const student: MockStudent = { id: "stu-1", schoolId: "school-a", isActive: true };
    const { db } = createMockDb({ tags: [tag], students: [student] });

    await expect(
      bulkAllocateFromInventory(CTX, { assignments: [{ tagId: tag.id, studentId: student.id }], reason: "x" }, db),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rejects when student already has an active wristband", async () => {
    const tag = makeTag({ schoolId: "school-a", tagMode: "UID", physicalUid: "WB01", status: "REGISTERED" });
    const student: MockStudent = { id: "stu-1", schoolId: "school-a", isActive: true };
    const existingCred: MockCredential = {
      id: "cred-existing",
      schoolId: "school-a",
      studentId: "stu-1",
      type: "NFC_WRISTBAND",
      credentialUID: "EXISTING",
      status: "ACTIVE",
      issuedAt: new Date(),
      deactivatedAt: null,
      deactivatedReason: null,
      scanToken: null,
      issuedById: null,
    };
    const { db } = createMockDb({ tags: [tag], students: [student], credentials: [existingCred] });

    await expect(
      bulkAllocateFromInventory(CTX, { assignments: [{ tagId: tag.id, studentId: student.id }], reason: "x" }, db),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rejects tenant isolation (tag from another school)", async () => {
    const tag = makeTag({ schoolId: "school-b", tagMode: "UID", physicalUid: "WB01", status: "REGISTERED" });
    const student: MockStudent = { id: "stu-1", schoolId: "school-a", isActive: true };
    const { db } = createMockDb({ tags: [tag], students: [student] });

    await expect(
      bulkAllocateFromInventory(CTX, { assignments: [{ tagId: tag.id, studentId: student.id }], reason: "x" }, db),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("rejects intra-request duplicate tagId", async () => {
    const tag = makeTag({ schoolId: "school-a", tagMode: "UID", physicalUid: "WB01", status: "REGISTERED" });
    const student1: MockStudent = { id: "stu-1", schoolId: "school-a", isActive: true };
    const student2: MockStudent = { id: "stu-2", schoolId: "school-a", isActive: true };
    const { db } = createMockDb({ tags: [tag], students: [student1, student2] });

    await expect(
      bulkAllocateFromInventory(
        CTX,
        {
          assignments: [
            { tagId: tag.id, studentId: student1.id },
            { tagId: tag.id, studentId: student2.id },
          ],
          reason: "x",
        },
        db,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("requires reason", async () => {
    const tag = makeTag({ schoolId: "school-a", tagMode: "UID", physicalUid: "WB01", status: "REGISTERED" });
    const student: MockStudent = { id: "stu-1", schoolId: "school-a", isActive: true };
    const { db } = createMockDb({ tags: [tag], students: [student] });

    await expect(
      bulkAllocateFromInventory(CTX, { assignments: [{ tagId: tag.id, studentId: student.id }], reason: "  " }, db),
    ).rejects.toMatchObject({ status: 400 });
  });
});
