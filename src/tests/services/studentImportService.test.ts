import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  commitStudentImport,
  createStudentImportJob,
  parseStudentsCsv,
  parseStudentsXlsx,
  previewStudentImport,
} from "../../server/services/studentImportService";
import { utils, write } from "xlsx";
import type { StudentImportRowInput } from "../../shared/types/students";

/** Minimal in-memory Prisma fake covering everything the import service touches. */
function makeFakeDb(seedCount = 7) {
  let idSeq = 0;
  const uid = (p: string) => `${p}-${(idSeq += 1)}`;

  const school = { id: "school-1", code: "SCU-PREVIEW", name: "Preview" };
  const classes = [
    { id: "class-s1a", schoolId: school.id, name: "Senior 1 A", code: "S1A", streams: [{ id: "stream-a", classId: "class-s1a", name: "A", code: "A" }] },
    { id: "class-s1b", schoolId: school.id, name: "Senior 1 B", code: "S1B", streams: [{ id: "stream-b", classId: "class-s1b", name: "B", code: "B" }] },
  ];
  const academicYears = [{ id: "year-1", isActive: true, terms: [{ id: "term-1", isActive: true }] }];

  const students: Array<{ id: string; schoolId: string; admissionNumber: string; firstName: string; lastName: string; isActive: boolean }> = [];
  const enrollments: Array<Record<string, unknown>> = [];
  const guardians: Array<Record<string, unknown>> = [];
  const batches = new Map<string, { id: string; schoolId: string; status: string; source: string; summary: string | null; createdAt: Date; updatedAt: Date }>();
  const importRows: Array<Record<string, unknown>> = [];
  const auditLogs: Array<Record<string, unknown>> = [];

  for (let i = 1; i <= seedCount; i += 1) {
    const id = uid("seed");
    students.push({ id, schoolId: school.id, admissionNumber: `S1A-${String(i).padStart(3, "0")}`, firstName: `Seeded${i}`, lastName: "Student", isActive: true });
    enrollments.push({ studentId: id, academicYearId: "year-1", termId: "term-1", classId: "class-s1a", streamId: "stream-a", isActive: true, status: "ACTIVE" });
  }

  const schoolInclude = () => ({
    ...school,
    classes,
    students: students.map((s) => ({ id: s.id, admissionNumber: s.admissionNumber })),
    academicYears,
  });

  const db = {
    school: {
      findUnique: async ({ where }: { where: { code?: string } }) => (where.code === school.code ? schoolInclude() : null),
      findUniqueOrThrow: async () => schoolInclude(),
    },
    markImportBatch: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const batch = { id: uid("batch"), schoolId: data.schoolId as string, status: data.status as string, source: data.source as string, summary: (data.summary as string) ?? null, createdAt: new Date(), updatedAt: new Date() };
        batches.set(batch.id, batch);
        return batch;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const batch = batches.get(where.id)!;
        if (data.status) batch.status = data.status as string;
        if (data.summary !== undefined) batch.summary = data.summary as string;
        batch.updatedAt = new Date();
        return batch;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const batch = batches.get(where.id);
        return batch ? { ...batch, school: schoolInclude() } : null;
      },
      findFirst: async ({ where }: { where: { id: string } }) => batches.get(where.id) ?? null,
      findMany: async () => [],
    },
    student: {
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        let count = 0;
        for (const row of data) {
          if (students.some((s) => s.admissionNumber.toLowerCase() === String(row.admissionNumber).toLowerCase())) continue; // skipDuplicates
          students.push({ id: uid("st"), schoolId: row.schoolId as string, admissionNumber: row.admissionNumber as string, firstName: row.firstName as string, lastName: row.lastName as string, isActive: row.isActive as boolean });
          count += 1;
        }
        return { count };
      },
      findMany: async ({ where }: { where: { admissionNumber?: { in: string[] } } }) => {
        const wanted = new Set((where.admissionNumber?.in ?? []).map((a) => a.toLowerCase()));
        return students.filter((s) => wanted.has(s.admissionNumber.toLowerCase())).map((s) => ({ id: s.id, admissionNumber: s.admissionNumber }));
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (students.some((s) => s.admissionNumber.toLowerCase() === String(data.admissionNumber).toLowerCase())) throw new Error("Unique constraint failed on admissionNumber");
        const st = { id: uid("st"), schoolId: data.schoolId as string, admissionNumber: data.admissionNumber as string, firstName: data.firstName as string, lastName: data.lastName as string, isActive: data.isActive as boolean };
        students.push(st);
        return st;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const st = students.find((s) => s.id === where.id)!;
        Object.assign(st, data);
        return st;
      },
    },
    classEnrollment: {
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        for (const row of data) {
          if (enrollments.some((e) => e.studentId === row.studentId && e.academicYearId === row.academicYearId && e.termId === row.termId)) continue;
          enrollments.push(row);
        }
        return { count: data.length };
      },
    },
    guardianContact: {
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        guardians.push(...data);
        return { count: data.length };
      },
    },
    markImportRow: {
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        importRows.push(...data);
        return { count: data.length };
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        importRows.push(data);
        return data;
      },
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        auditLogs.push(data);
        return data;
      },
    },
  };

  return { db: db as unknown as PrismaClient, state: { students, enrollments, guardians, batches, importRows, auditLogs } };
}

function makeRows(count: number, opts: { prefix?: string; className?: string; streamName?: string } = {}): StudentImportRowInput[] {
  return Array.from({ length: count }, (_, i) => ({
    admissionNumber: `${opts.prefix ?? "NEW"}-${String(i + 1).padStart(4, "0")}`,
    fullName: `Test Student ${i + 1}`,
    gender: i % 2 ? "Male" : "Female",
    className: opts.className ?? "Senior 1 A",
    streamName: opts.streamName ?? "A",
    guardianName: `Guardian ${i + 1}`,
    guardianPhone: "+256700000000",
    guardianEmail: "",
    status: "ACTIVE",
  }));
}

async function waitForJob(state: ReturnType<typeof makeFakeDb>["state"], jobId: string, timeoutMs = 5000) {
  const start = Date.now();
  for (;;) {
    const batch = state.batches.get(jobId);
    if (batch && (batch.status === "COMMITTED" || batch.status === "FAILED")) return batch;
    if (Date.now() - start > timeoutMs) throw new Error("Job did not finish in time");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("student import scaling", () => {
  for (const count of [100, 250, 300]) {
    it(`imports ${count} new students with enrollments and progress`, async () => {
      const { db, state } = makeFakeDb();
      const seededBefore = state.students.length;
      const job = await createStudentImportJob(db, "SCU-PREVIEW", makeRows(count));
      expect(job.totalRows).toBe(count);
      const batch = await waitForJob(state, job.jobId);
      expect(batch.status).toBe("COMMITTED");
      const summary = JSON.parse(batch.summary!);
      expect(summary.processedRows).toBe(count);
      expect(summary.successCount).toBe(count);
      expect(summary.failedCount).toBe(0);
      expect(state.students.length).toBe(seededBefore + count);
      expect(state.enrollments.length).toBe(seededBefore + count);
      expect(state.auditLogs[0]).toMatchObject({ action: "student.import.commit" });
    });
  }

  it("processes ALL rows, not just the preview slice (the 250-row bug)", async () => {
    const { db, state } = makeFakeDb();
    const job = await createStudentImportJob(db, "SCU-PREVIEW", makeRows(250));
    const batch = await waitForJob(state, job.jobId);
    const summary = JSON.parse(batch.summary!);
    expect(summary.processedRows).toBe(250);
    expect(summary.totalRows).toBe(250);
  });
});

describe("student import data safety (append-only default)", () => {
  it("seeded students remain and are not overwritten when admission numbers collide", async () => {
    const { db, state } = makeFakeDb(7);
    const before = state.students.map((s) => ({ ...s }));
    // file collides with seeded S1A-001..S1A-007
    const rows = makeRows(7, { prefix: "S1A" }).map((r, i) => ({ ...r, admissionNumber: `S1A-${String(i + 1).padStart(3, "0")}`, fullName: "Overwriter Attempt" }));
    const job = await createStudentImportJob(db, "SCU-PREVIEW", rows);
    const batch = await waitForJob(state, job.jobId);
    const summary = JSON.parse(batch.summary!);
    expect(summary.duplicateCount).toBe(7);
    expect(summary.successCount).toBe(0);
    expect(state.students.length).toBe(before.length); // nothing added, nothing removed
    for (const seeded of before) {
      const after = state.students.find((s) => s.id === seeded.id)!;
      expect(after.firstName).toBe(seeded.firstName); // names untouched
      expect(after.isActive).toBe(true);
    }
    expect(state.enrollments.length).toBe(before.length); // enrollments untouched
  });

  it("mixed file: duplicates skipped, new students appended", async () => {
    const { db, state } = makeFakeDb(7);
    const rows = [...makeRows(3, { prefix: "S1A" }).map((r, i) => ({ ...r, admissionNumber: `S1A-${String(i + 1).padStart(3, "0")}` })), ...makeRows(5, { prefix: "FRESH" })];
    const job = await createStudentImportJob(db, "SCU-PREVIEW", rows);
    const batch = await waitForJob(state, job.jobId);
    const summary = JSON.parse(batch.summary!);
    expect(summary.duplicateCount).toBe(3);
    expect(summary.successCount).toBe(5);
    expect(state.students.length).toBe(7 + 5);
  });

  it("update mode only changes names with explicit CREATE_AND_UPDATE_EXISTING", async () => {
    const { db, state } = makeFakeDb(2);
    const rows = [{ admissionNumber: "S1A-001", fullName: "Updated Name", gender: "Male", className: "Senior 1 A", streamName: "A", status: "ACTIVE" }];
    const job = await createStudentImportJob(db, "SCU-PREVIEW", rows as StudentImportRowInput[], "CREATE_AND_UPDATE_EXISTING");
    const batch = await waitForJob(state, job.jobId);
    const summary = JSON.parse(batch.summary!);
    expect(summary.successCount).toBe(1);
    expect(state.students.find((s) => s.admissionNumber === "S1A-001")!.firstName).toBe("Updated");
    expect(state.students.length).toBe(2); // no new students
  });

  it("never creates classes or streams from import files", async () => {
    const { db } = makeFakeDb();
    const preview = await previewStudentImport(db, "SCU-PREVIEW", makeRows(3, { className: "Senior 99", streamName: "Z" }));
    expect(preview.invalidRows).toBe(3);
    expect(preview.rows[0]!.errors.join(" ")).toContain('Class "Senior 99" does not exist');
  });
});

describe("student import error isolation", () => {
  it("one bad row in 300 does not kill the import", async () => {
    const { db, state } = makeFakeDb();
    const rows = makeRows(300);
    rows[137] = { ...rows[137]!, fullName: "", gender: "" }; // bad row
    const result = await commitStudentImport(db, "SCU-PREVIEW", rows);
    expect(result.status).toBe("COMMITTED");
    const jobId = (result as { jobId: string }).jobId;
    const batch = await waitForJob(state, jobId);
    const summary = JSON.parse(batch.summary!);
    expect(summary.successCount).toBe(299);
    expect(summary.failedCount).toBe(1);
    expect(summary.rowErrors.length).toBe(1);
    expect(summary.rowErrors[0].rowNumber).toBe(139); // index 137 + header expect(summary.rowErrors[0].rowNumber).toBe(140); // 138th row + header offset 1-based offset
  });

  it("in-file duplicate admission numbers are reported, not imported twice", async () => {
    const { db, state } = makeFakeDb();
    const rows = [...makeRows(5), { ...makeRows(1)[0]!, admissionNumber: "NEW-0001" }];
    const job = await createStudentImportJob(db, "SCU-PREVIEW", rows);
    const batch = await waitForJob(state, job.jobId);
    const summary = JSON.parse(batch.summary!);
    expect(summary.successCount).toBe(5);
    expect(summary.failedCount).toBe(1);
    expect(state.students.filter((s) => s.admissionNumber === "NEW-0001").length).toBe(1);
  });

  it("commit refuses only when zero rows are importable", async () => {
    const { db } = makeFakeDb();
    const rows = makeRows(2).map((r) => ({ ...r, fullName: "" }));
    const result = await commitStudentImport(db, "SCU-PREVIEW", rows);
    expect(result.status).toBe("PREVIEW");
  });
});

describe("student import preview", () => {
  it("caps preview rows at 50 but reports full totals", async () => {
    const { db } = makeFakeDb();
    const preview = await previewStudentImport(db, "SCU-PREVIEW", makeRows(300));
    expect(preview.totalRows).toBe(300);
    expect(preview.validRows).toBe(300);
    expect(preview.rows.length).toBe(50);
  });
});

describe("fuzzy header parsing", () => {
  it("parseStudentsCsv handles human-readable headers with spaces", () => {
    const csv = "Admission Number,Full Name,Gender,Class,Stream,Guardian Name,Guardian Phone,Guardian Email,Status\nADM-001,Jane Doe,Female,Senior 1 A,A,Mary Doe,0700000001,jane@example.com,ACTIVE\n";
    const rows = parseStudentsCsv(csv);
    expect(rows[0]?.admissionNumber).toBe("ADM-001");
    expect(rows[0]?.fullName).toBe("Jane Doe");
    expect(rows[0]?.gender).toBe("Female");
    expect(rows[0]?.className).toBe("Senior 1 A");
  });

  it("parseStudentsXlsx handles human-readable headers with spaces", () => {
    const ws = utils.aoa_to_sheet([
      ["Admission Number", "Full Name", "Gender", "Class", "Stream", "Guardian Name", "Guardian Phone", "Guardian Email", "Status"],
      ["ADM-002", "John Smith", "Male", "Senior 1 B", "B", "James Smith", "0700000002", "john@example.com", "ACTIVE"],
    ]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Students");
    const buffer = Buffer.from(write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer);
    const rows = parseStudentsXlsx(buffer);
    expect(rows[0]?.admissionNumber).toBe("ADM-002");
    expect(rows[0]?.fullName).toBe("John Smith");
    expect(rows[0]?.gender).toBe("Male");
    expect(rows[0]?.className).toBe("Senior 1 B");
  });
});
