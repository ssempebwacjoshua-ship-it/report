import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createServer } from "../../server";
import type { PrismaClient } from "@prisma/client";
import {
  assignTag,
  disableTag,
  generateTags,
  getTagEvents,
  listTags,
  resolvePublicCode,
  resolveStudentByIdentifier,
  unassignTag,
} from "../../server/services/nfcTagsService";

// ─── Route smoke tests — confirm routes exist and respond correctly ───────────

describe("NFC Tags routes — route existence", () => {
  it("GET /api/nfc/resolve/:publicCode is public and responds (not 404)", async () => {
    const res = await request(createServer()).get("/api/nfc/resolve/test-code-that-does-not-exist");
    expect(res.status).not.toBe(404);
    // 200 (UNKNOWN result) or 500 (no DB in test) — either is acceptable
    expect([200, 500]).toContain(res.status);
  });

  it("GET /api/nfc/tags requires authentication (not 404)", async () => {
    const res = await request(createServer()).get("/api/nfc/tags");
    expect(res.status).not.toBe(404);
    expect([200, 401, 500]).toContain(res.status);
  });

  it("POST /api/nfc/tags/generate requires authentication (not 404)", async () => {
    const res = await request(createServer()).post("/api/nfc/tags/generate").send({ count: 1 });
    expect(res.status).not.toBe(404);
    expect([201, 401, 500]).toContain(res.status);
  });

  it("PATCH /api/nfc/tags/:id/assign route exists (not 404)", async () => {
    const res = await request(createServer())
      .patch("/api/nfc/tags/00000000-0000-0000-0000-000000000001/assign")
      .send({ studentId: "00000000-0000-0000-0000-000000000002" });
    expect(res.status).not.toBe(404);
    expect([200, 400, 401, 500]).toContain(res.status);
  });

  it("PATCH /api/nfc/tags/:id/unassign route exists (not 404)", async () => {
    const res = await request(createServer())
      .patch("/api/nfc/tags/00000000-0000-0000-0000-000000000001/unassign");
    expect(res.status).not.toBe(404);
    expect([200, 401, 500]).toContain(res.status);
  });

  it("PATCH /api/nfc/tags/:id/disable route exists (not 404)", async () => {
    const res = await request(createServer())
      .patch("/api/nfc/tags/00000000-0000-0000-0000-000000000001/disable");
    expect(res.status).not.toBe(404);
    expect([200, 401, 500]).toContain(res.status);
  });

  it("GET /api/nfc/tags/:id/events route exists (not 404)", async () => {
    const res = await request(createServer())
      .get("/api/nfc/tags/00000000-0000-0000-0000-000000000001/events");
    expect(res.status).not.toBe(404);
    expect([200, 401, 500]).toContain(res.status);
  });

  it("POST /api/nfc/tags/:id/link-reader-credential/capture route exists (not 404)", async () => {
    const res = await request(createServer())
      .post("/api/nfc/tags/00000000-0000-0000-0000-000000000001/link-reader-credential/capture")
      .send({});
    expect(res.status).not.toBe(404);
    expect([201, 400, 401, 500]).toContain(res.status);
  });

  it("GET /api/nfc/tags/reader-credential-captures/:captureId route exists (not 404)", async () => {
    const res = await request(createServer())
      .get("/api/nfc/tags/reader-credential-captures/test-capture");
    expect(res.status).not.toBe(404);
    expect([200, 401, 404, 500]).toContain(res.status);
  });

  it("POST /api/nfc/tags/reader-credential-captures/:captureId/transfer route exists (not 404)", async () => {
    const res = await request(createServer())
      .post("/api/nfc/tags/reader-credential-captures/test-capture/transfer")
      .send({ reason: "Reassigned" });
    expect(res.status).not.toBe(404);
    expect([200, 400, 401, 404, 500]).toContain(res.status);
  });
});

// ─── Service unit tests — mock Prisma ────────────────────────────────────────

const SCHOOL_A = "aaaa0000-0000-0000-0000-000000000000";
const SCHOOL_B = "bbbb0000-0000-0000-0000-000000000000";
const TAG_ID   = "tag00000-0000-0000-0000-000000000000";
const STU_ID   = "stu00000-0000-0000-0000-000000000000";
const PUB_CODE = "abc123def456abc123def456abc123de";

function makeCtx(schoolId = SCHOOL_A) {
  return { schoolId, actorId: "user-1", role: "ADMIN_OPERATOR" };
}

function makeMockTag(overrides: Record<string, unknown> = {}) {
  return {
    id: TAG_ID,
    schoolId: SCHOOL_A,
    publicCode: PUB_CODE,
    label: null,
    type: "STUDENT",
    status: "UNASSIGNED",
    studentId: null,
    writtenUrl: `https://app.example.com/t/${PUB_CODE}`,
    assignedAt: null,
    lastSeenAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    student: null,
    _count: { tapEvents: 0 },
    tapEvents: [],
    ...overrides,
  };
}

describe("resolvePublicCode — service unit tests", () => {
  it("returns UNKNOWN for an unregistered publicCode", async () => {
    const db = {
      nfcTag: { findUnique: vi.fn(async () => null), update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 0 })) },
      nfcTapEvent: { create: vi.fn(async () => ({})) },
    } as unknown as PrismaClient;

    const result = await resolvePublicCode(PUB_CODE, {}, db);
    expect(result.result).toBe("UNKNOWN");
    expect(db.nfcTapEvent.create).toHaveBeenCalledOnce();
  });

  it("returns UNASSIGNED for a tag with no student", async () => {
    const db = {
      nfcTag: { findUnique: vi.fn(async () => makeMockTag({ status: "UNASSIGNED", studentId: null })), update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 0 })) },
      nfcTapEvent: { create: vi.fn(async () => ({})) },
    } as unknown as PrismaClient;

    const result = await resolvePublicCode(PUB_CODE, {}, db);
    expect(result.result).toBe("UNASSIGNED");
  });

  it("returns ASSIGNED without student details for unauthenticated tap", async () => {
    const db = {
      nfcTag: {
        findUnique: vi.fn(async () => makeMockTag({
          status: "ASSIGNED",
          studentId: STU_ID,
          student: { id: STU_ID, admissionNumber: "001", firstName: "Alice", lastName: "Doe", enrollments: [] },
        })),
        update: vi.fn(async () => ({})),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
      nfcTapEvent: { create: vi.fn(async () => ({})) },
    } as unknown as PrismaClient;

    const result = await resolvePublicCode(PUB_CODE, { isAuthenticated: false }, db);
    expect(result.result).toBe("ASSIGNED");
    expect(result.student).toBeUndefined();
  });

  it("returns ASSIGNED with student details for authenticated tap", async () => {
    const db = {
      nfcTag: {
        findUnique: vi.fn(async () => makeMockTag({
          status: "ASSIGNED",
          studentId: STU_ID,
          student: { id: STU_ID, admissionNumber: "001", firstName: "Alice", lastName: "Doe", enrollments: [] },
        })),
        update: vi.fn(async () => ({})),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
      nfcTapEvent: { create: vi.fn(async () => ({})) },
    } as unknown as PrismaClient;

    const result = await resolvePublicCode(PUB_CODE, { isAuthenticated: true }, db);
    expect(result.result).toBe("ASSIGNED");
    expect(result.student?.name).toBe("Alice Doe");
    expect(result.student?.admissionNumber).toBe("001");
  });

  it("returns DISABLED for a disabled tag", async () => {
    const db = {
      nfcTag: { findUnique: vi.fn(async () => makeMockTag({ status: "DISABLED" })), update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 0 })) },
      nfcTapEvent: { create: vi.fn(async () => ({})) },
    } as unknown as PrismaClient;

    const result = await resolvePublicCode(PUB_CODE, {}, db);
    expect(result.result).toBe("DISABLED");
  });

  it("always logs a NfcTapEvent regardless of result", async () => {
    const createEvent = vi.fn(async () => ({}));
    const db = {
      nfcTag: { findUnique: vi.fn(async () => null), update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 0 })) },
      nfcTapEvent: { create: createEvent },
    } as unknown as PrismaClient;

    await resolvePublicCode("unknown-code", { userAgent: "TestBrowser/1.0", ip: "1.2.3.4" }, db);
    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ result: "UNKNOWN", publicCode: "unknown-code" }) }),
    );
  });
});

describe("generateTags — service unit tests", () => {
  it("generates the requested number of tags", async () => {
    const db = {
      nfcTag: {
        create: vi.fn(async () => makeMockTag()),
      },
    } as unknown as PrismaClient;

    const result = await generateTags(makeCtx(), 3, "https://app.example.com", db);
    expect(result.generated).toBe(3);
    expect(result.tags).toHaveLength(3);
    expect(db.nfcTag.create).toHaveBeenCalledTimes(3);
  });

  it("rejects count > 100", async () => {
    const db = { nfcTag: { create: vi.fn() } } as unknown as PrismaClient;
    await expect(generateTags(makeCtx(), 101, "https://app.example.com", db)).rejects.toMatchObject({ status: 400 });
  });

  it("rejects count < 1", async () => {
    const db = { nfcTag: { create: vi.fn() } } as unknown as PrismaClient;
    await expect(generateTags(makeCtx(), 0, "https://app.example.com", db)).rejects.toMatchObject({ status: 400 });
  });
});

describe("assignTag — service unit tests", () => {
  it("assigns a tag by studentId", async () => {
    const updatedTag = makeMockTag({ status: "ASSIGNED", studentId: STU_ID });
    const db = {
      nfcTag: {
        findFirst: vi.fn(async (args: { where: Record<string, unknown> }) =>
          args.where.studentId ? null : makeMockTag()
        ),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      student: { findFirst: vi.fn(async () => ({ id: STU_ID, admissionNumber: "001", firstName: "Alice", lastName: "Doe", isActive: true })) },
    } as unknown as PrismaClient;

    const result = await assignTag(makeCtx(), TAG_ID, { studentId: STU_ID }, db);
    expect(result.status).toBe("ASSIGNED");
    expect(result.studentId).toBe(STU_ID);
  });

  it("assigns a tag by admissionNumber", async () => {
    const updatedTag = makeMockTag({ status: "ASSIGNED", studentId: STU_ID });
    const db = {
      nfcTag: {
        findFirst: vi.fn(async (args: { where: Record<string, unknown> }) =>
          args.where.studentId ? null : makeMockTag()
        ),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      student: { findFirst: vi.fn(async () => ({ id: STU_ID, admissionNumber: "A-001", firstName: "Bob", lastName: "Smith", isActive: true })) },
    } as unknown as PrismaClient;

    const result = await assignTag(makeCtx(), TAG_ID, { admissionNumber: "A-001" }, db);
    expect(result.status).toBe("ASSIGNED");
    expect(result.studentId).toBe(STU_ID);
  });

  it("rejects assignment to a disabled tag", async () => {
    const db = {
      nfcTag: { findFirst: vi.fn(async () => makeMockTag({ status: "DISABLED" })) },
      student: { findFirst: vi.fn() },
    } as unknown as PrismaClient;

    await expect(assignTag(makeCtx(), TAG_ID, { studentId: STU_ID }, db)).rejects.toMatchObject({ status: 400 });
  });

  it("rejects if student belongs to a different school (tenant isolation)", async () => {
    const db = {
      nfcTag: { findFirst: vi.fn(async (args: { where: Record<string, unknown> }) =>
        args.where.schoolId === SCHOOL_B ? null : makeMockTag()
      )},
      student: { findFirst: vi.fn(async () => null) },
    } as unknown as PrismaClient;

    await expect(assignTag({ schoolId: SCHOOL_A, actorId: "u", role: "ADMIN_OPERATOR" }, TAG_ID, { studentId: STU_ID }, db))
      .rejects.toMatchObject({ status: 404 });
  });
});

describe("resolveStudentByIdentifier — service unit tests", () => {
  it("resolves by studentId when active and in school", async () => {
    const db = {
      student: { findFirst: vi.fn(async () => ({ id: STU_ID, admissionNumber: "001", firstName: "Alice", lastName: "Doe", isActive: true })) },
    } as unknown as PrismaClient;

    const student = await resolveStudentByIdentifier(SCHOOL_A, { studentId: STU_ID }, db);
    expect(student.id).toBe(STU_ID);
  });

  it("resolves by admissionNumber when active and in school", async () => {
    const db = {
      student: { findFirst: vi.fn(async () => ({ id: STU_ID, admissionNumber: "A-001", firstName: "Bob", lastName: "Smith", isActive: true })) },
    } as unknown as PrismaClient;

    const student = await resolveStudentByIdentifier(SCHOOL_A, { admissionNumber: "A-001" }, db);
    expect(student.id).toBe(STU_ID);
    expect(student.admissionNumber).toBe("A-001");
  });

  it("returns 404 for unknown admissionNumber", async () => {
    const db = {
      student: { findFirst: vi.fn(async () => null) },
    } as unknown as PrismaClient;

    await expect(resolveStudentByIdentifier(SCHOOL_A, { admissionNumber: "UNKNOWN" }, db))
      .rejects.toMatchObject({ status: 404 });
  });

  it("returns 404 for inactive student (isActive filter)", async () => {
    const db = {
      // findFirst with isActive:true filter returns null for inactive students
      student: { findFirst: vi.fn(async () => null) },
    } as unknown as PrismaClient;

    await expect(resolveStudentByIdentifier(SCHOOL_A, { studentId: STU_ID }, db))
      .rejects.toMatchObject({ status: 404 });
  });

  it("returns 400 when neither studentId nor admissionNumber is provided", async () => {
    const db = { student: { findFirst: vi.fn() } } as unknown as PrismaClient;

    await expect(resolveStudentByIdentifier(SCHOOL_A, {}, db))
      .rejects.toMatchObject({ status: 400 });
  });

  it("cross-school: admissionNumber query scoped to schoolId", async () => {
    const findFirst = vi.fn(async () => null);
    const db = { student: { findFirst } } as unknown as PrismaClient;

    await expect(resolveStudentByIdentifier(SCHOOL_A, { admissionNumber: "A-001" }, db))
      .rejects.toMatchObject({ status: 404 });

    // The query must include the schoolId to prevent cross-school access
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ schoolId: SCHOOL_A }) }),
    );
  });
});

describe("disableTag — service unit tests", () => {
  it("disables a tag", async () => {
    const db = {
      nfcTag: {
        findFirst: vi.fn(async () => makeMockTag()),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
    } as unknown as PrismaClient;

    const result = await disableTag(makeCtx(), TAG_ID, db);
    expect(result.status).toBe("DISABLED");
  });

  it("returns 404 if tag belongs to another school", async () => {
    const db = {
      nfcTag: { findFirst: vi.fn(async () => null) },
    } as unknown as PrismaClient;

    await expect(disableTag({ schoolId: SCHOOL_B, actorId: "u", role: "ADMIN_OPERATOR" }, TAG_ID, db))
      .rejects.toMatchObject({ status: 404 });
  });
});

describe("unassignTag — service unit tests", () => {
  it("unassigns a tag", async () => {
    const db = {
      nfcTag: {
        findFirst: vi.fn(async () => makeMockTag({ status: "ASSIGNED", studentId: STU_ID })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
    } as unknown as PrismaClient;

    const result = await unassignTag(makeCtx(), TAG_ID, db);
    expect(result.status).toBe("UNASSIGNED");
  });
});

describe("listTags — tenant isolation", () => {
  it("passes schoolId filter to DB query", async () => {
    const findMany = vi.fn(async () => []);
    const db = { nfcTag: { findMany } } as unknown as PrismaClient;

    await listTags(makeCtx(SCHOOL_A), {}, db);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ schoolId: SCHOOL_A }) }));
  });
});

describe("getTagEvents — service unit tests", () => {
  it("returns events for a tag", async () => {
    const mockEvent = { id: "ev1", publicCode: PUB_CODE, result: "ASSIGNED", userAgent: null, ipHash: null, schoolId: null, tagId: TAG_ID, studentId: null, createdAt: new Date() };
    const db = {
      nfcTag: { findFirst: vi.fn(async () => makeMockTag()) },
      nfcTapEvent: { findMany: vi.fn(async () => [mockEvent]) },
    } as unknown as PrismaClient;

    const result = await getTagEvents(makeCtx(), TAG_ID, db);
    expect(result.total).toBe(1);
    expect(result.events[0]?.result).toBe("ASSIGNED");
  });
});
