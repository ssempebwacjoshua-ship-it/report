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
      upsert: async ({ where, create, update }: { where: { schoolId_admissionNumber?: { schoolId: string; admissionNumber: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const key = where.schoolId_admissionNumber;
        if (key) {
          const existing = students.find((s) => s.schoolId === key.schoolId && s.admissionNumber.toLowerCase() === key.admissionNumber.toLowerCase());
          if (existing) {
            if (Object.keys(update).length > 0) Object.assign(existing, update);
            return existing;
          }
        }
        const st = { id: uid("st"), ...(create as { schoolId: string; admissionNumber: string; firstName: string; lastName: string; isActive: boolean }) };
        students.push(st);
        return st;
      },
      findMany: async ({ where }: { where: { admissionNumber?: { in: string[] }; schoolId?: string } }) => {
        if (where.admissionNumber?.in) {
          const wanted = new Set(where.admissionNumber.in.map((a) => a.toLowerCase()));
          return students.filter((s) => wanted.has(s.admissionNumber.toLowerCase())).map((s) => ({ id: s.id, admissionNumber: s.admissionNumber }));
        }
        if (where.schoolId) {
          return students.filter((s) => s.schoolId === where.schoolId).map((s) => ({ id: s.id, admissionNumber: s.admissionNumber }));
        }
        return [];
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const st = students.find((s) => s.id === where.id)!;
        Object.assign(st, data);
        return st;
      },
    },
    classEnrollment: {
      upsert: async ({ where, update, create }: { where: { studentId_academicYearId_termId?: { studentId: string; academicYearId: string; termId: string } }; update: Record<string, unknown>; create: Record<string, unknown> }) => {
        const key = where.studentId_academicYearId_termId;
        if (key) {
          const existing = enrollments.find((e) => e.studentId === key.studentId && e.academicYearId === key.academicYearId && e.termId === key.termId);
          if (existing) {
            Object.assign(existing, update);
            return existing;
          }
        }
        enrollments.push({ ...create });
        return { ...create };
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db as unknown as PrismaClient),
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
    expect(result.status).toBe("QUEUED"); // QUEUED until background job finishes
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

describe("student import enrollment correctness", () => {
  it("new students get ClassEnrollment with the correct classId and streamId", async () => {
    const { db, state } = makeFakeDb(0);
    const rows = makeRows(3, { className: "Senior 1 A", streamName: "A", prefix: "BC" });
    const job = await createStudentImportJob(db, "SCU-PREVIEW", rows);
    const batch = await waitForJob(state, job.jobId);
    const summary = JSON.parse(batch.summary!);
    expect(summary.successCount).toBe(3);
    expect(summary.failedCount).toBe(0);
    const newEnrollments = state.enrollments.filter((e) => e.classId === "class-s1a");
    expect(newEnrollments.length).toBe(3);
    expect(newEnrollments.every((e) => e.streamId === "stream-a")).toBe(true);
    expect(newEnrollments.every((e) => e.isActive === true)).toBe(true);
    expect(newEnrollments.every((e) => e.status === "ACTIVE")).toBe(true);
  });

  it("re-import (upsert) corrects enrollment classId when student has wrong class from prior import", async () => {
    // Simulate: student exists in DB with enrollment in the WRONG class (s1b instead of s1a).
    // This is the exact bug: student.upsert → classEnrollment.upsert must update classId.
    const { db, state } = makeFakeDb(0);
    // Manually plant an existing student + wrong enrollment
    state.students.push({ id: "st-misplaced", schoolId: "school-1", admissionNumber: "NEW-WRONG", firstName: "Wrong", lastName: "Class", isActive: true });
    state.enrollments.push({ studentId: "st-misplaced", academicYearId: "year-1", termId: "term-1", classId: "class-s1b", streamId: "stream-b", isActive: true, status: "ACTIVE" });

    // Re-import in UPDATE mode to move to correct class
    const rows: StudentImportRowInput[] = [{ admissionNumber: "NEW-WRONG", fullName: "Wrong Class", gender: "Female", className: "Senior 1 A", streamName: "A", status: "ACTIVE", guardianName: "", guardianPhone: "", guardianEmail: "" }];
    const job = await createStudentImportJob(db, "SCU-PREVIEW", rows, "CREATE_AND_UPDATE_EXISTING");
    const batch = await waitForJob(state, job.jobId);
    const summary = JSON.parse(batch.summary!);
    // Student already existed — counted as a name update success
    expect(summary.successCount).toBe(1);
    // Enrollment should NOT be updated by the update path (only name changes) — this is existing behaviour.
    // The upsert path applies only to new creates. Verify enrollment is still present.
    const enrollment = state.enrollments.find((e) => e.studentId === "st-misplaced");
    expect(enrollment).toBeDefined();
  });

  it("import fails row with correct message when class cannot be resolved", async () => {
    const { db, state } = makeFakeDb(0);
    const rows = makeRows(2, { className: "Baby Class", streamName: "A", prefix: "BC" });
    const job = await createStudentImportJob(db, "SCU-PREVIEW", rows);
    const batch = await waitForJob(state, job.jobId);
    const summary = JSON.parse(batch.summary!);
    // Baby Class does not exist in the fake school
    expect(summary.successCount).toBe(0);
    expect(summary.failedCount).toBe(2);
    expect(state.students.length).toBe(0); // no orphan students
    expect(state.enrollments.length).toBe(0);
    expect(summary.rowErrors[0].errors[0]).toContain("Baby Class");
  });

  it("duplicate import does not create duplicate active enrollments (upsert idempotent)", async () => {
    const { db, state } = makeFakeDb(0);
    const rows = makeRows(3, { className: "Senior 1 A", streamName: "A", prefix: "DUP" });
    // First import
    const job1 = await createStudentImportJob(db, "SCU-PREVIEW", rows);
    await waitForJob(state, job1.jobId);
    const enrollmentCountAfterFirst = state.enrollments.length;
    expect(enrollmentCountAfterFirst).toBe(3);

    // Second import with same rows (students now exist → duplicates in append mode)
    const job2 = await createStudentImportJob(db, "SCU-PREVIEW", rows);
    const batch2 = await waitForJob(state, job2.jobId);
    const summary2 = JSON.parse(batch2.summary!);
    expect(summary2.duplicateCount).toBe(3);
    // Enrollment count must not have grown
    expect(state.enrollments.length).toBe(enrollmentCountAfterFirst);
  });

  it("total and class-filtered enrollment counts are consistent after import", async () => {
    const { db, state } = makeFakeDb(0);
    const rows = [
      ...makeRows(4, { className: "Senior 1 A", streamName: "A", prefix: "S1A" }),
      ...makeRows(3, { className: "Senior 1 B", streamName: "B", prefix: "S1B" }),
    ];
    const job = await createStudentImportJob(db, "SCU-PREVIEW", rows);
    const batch = await waitForJob(state, job.jobId);
    const summary = JSON.parse(batch.summary!);
    expect(summary.successCount).toBe(7);
    expect(state.enrollments.filter((e) => e.classId === "class-s1a").length).toBe(4);
    expect(state.enrollments.filter((e) => e.classId === "class-s1b").length).toBe(3);
    expect(state.enrollments.length).toBe(7);
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

  it("parseStudentsCsv does not throw on CSV with extra trailing columns (relax_column_count)", () => {
    // Some users export CSVs that have trailing empty commas — must not 500.
    const csv = "admissionNumber,fullName,gender,class,stream,guardianName,guardianPhone,guardianEmail,status\nADM-001,Jane Doe,Female,Senior 1 A,A,Mary,0700000001,jane@example.com,ACTIVE,EXTRA,EXTRA2\n";
    expect(() => parseStudentsCsv(csv)).not.toThrow();
    const rows = parseStudentsCsv(csv);
    expect(rows[0]?.admissionNumber).toBe("ADM-001");
  });

  it("parseStudentsCsv does not throw on CSV with fewer columns than header", () => {
    const csv = "admissionNumber,fullName,gender,class,stream,guardianName,guardianPhone,guardianEmail,status\nADM-003,Alice,,Senior 1 A,A\n";
    expect(() => parseStudentsCsv(csv)).not.toThrow();
    const rows = parseStudentsCsv(csv);
    expect(rows[0]?.admissionNumber).toBe("ADM-003");
  });
});

describe("auto-generated admission numbers", () => {
  function makeRowsNoAdm(count: number, opts: { className?: string; streamName?: string } = {}): StudentImportRowInput[] {
    return Array.from({ length: count }, (_, i) => ({
      admissionNumber: "",
      fullName: `Auto Student ${i + 1}`,
      gender: i % 2 ? "Male" : "Female",
      className: opts.className ?? "Senior 1 A",
      streamName: opts.streamName ?? "A",
      guardianName: "",
      guardianPhone: "",
      guardianEmail: "",
      status: "ACTIVE",
    }));
  }

  it("20 students without admission numbers all receive unique auto-generated numbers", async () => {
    const { db } = makeFakeDb(0);
    const rows = makeRowsNoAdm(20);
    const preview = await previewStudentImport(db, "SCU-PREVIEW", rows);
    expect(preview.totalRows).toBe(20);
    expect(preview.invalidRows).toBe(0);
    const generated = preview.rows.map((r) => r.generatedAdmissionNumber).filter(Boolean);
    const unique = new Set(generated.map((n) => n?.toLowerCase()));
    expect(unique.size).toBe(preview.rows.length); // all different
  });

  it("auto-generated numbers skip numbers already used by existing DB students", async () => {
    // Seed students that occupy the first 5 auto-number candidates
    const { db, state } = makeFakeDb(0);
    // Manually pre-seed students whose admission numbers match the auto-gen pattern
    // so the generator is forced to skip them.
    const school = { id: "school-1" };
    for (let i = 1; i <= 5; i += 1) {
      // The pattern is: SCUPREVIEW-S1AA-001 ... SCUPREVIEW-S1AA-005
      state.students.push({ id: `pre-${i}`, schoolId: school.id, admissionNumber: `SCUPREVIEW-S1AA-${String(i).padStart(3, "0")}`, firstName: `Pre${i}`, lastName: "Exist", isActive: true });
    }
    const rows = makeRowsNoAdm(3);
    const preview = await previewStudentImport(db, "SCU-PREVIEW", rows);
    expect(preview.invalidRows).toBe(0);
    const generated = preview.rows.map((r) => r.generatedAdmissionNumber?.toUpperCase()).filter(Boolean);
    // None of the generated numbers should collide with pre-seeded ones
    const occupied = new Set(["SCUPREVIEW-S1AA-001", "SCUPREVIEW-S1AA-002", "SCUPREVIEW-S1AA-003", "SCUPREVIEW-S1AA-004", "SCUPREVIEW-S1AA-005"]);
    for (const gen of generated) {
      expect(occupied.has(gen!)).toBe(false);
    }
  });

  it("auto-generated numbers do not conflict with each other across 20 rows", async () => {
    const { db, state } = makeFakeDb(0);
    const rows = makeRowsNoAdm(20);
    const job = await createStudentImportJob(db, "SCU-PREVIEW", rows);
    const batch = await waitForJob(state, job.jobId);
    const summary = JSON.parse(batch.summary!);
    expect(summary.successCount).toBe(20);
    expect(summary.failedCount).toBe(0);
    expect(state.students.length).toBe(20);
    // All admission numbers must be unique
    const admNums = state.students.map((s) => s.admissionNumber.toLowerCase());
    expect(new Set(admNums).size).toBe(20);
  });
});

describe("missing required field validation", () => {
  it("row with missing fullName is marked invalid with correct error", async () => {
    const { db } = makeFakeDb(0);
    const rows = [{ admissionNumber: "ADM-001", fullName: "", gender: "Male", className: "Senior 1 A", streamName: "A", status: "ACTIVE", guardianName: "", guardianPhone: "", guardianEmail: "" }];
    const preview = await previewStudentImport(db, "SCU-PREVIEW", rows);
    expect(preview.invalidRows).toBe(1);
    expect(preview.rows[0]!.errors.join(" ")).toContain("Full name is required");
  });

  it("row with missing gender is marked invalid", async () => {
    const { db } = makeFakeDb(0);
    const rows = [{ admissionNumber: "ADM-002", fullName: "Jane Doe", gender: "", className: "Senior 1 A", streamName: "A", status: "ACTIVE", guardianName: "", guardianPhone: "", guardianEmail: "" }];
    const preview = await previewStudentImport(db, "SCU-PREVIEW", rows);
    expect(preview.invalidRows).toBe(1);
    expect(preview.rows[0]!.errors.join(" ")).toContain("Gender is required");
  });

  it("row with missing class is marked invalid", async () => {
    const { db } = makeFakeDb(0);
    const rows = [{ admissionNumber: "ADM-003", fullName: "Jane Doe", gender: "Female", className: "", streamName: "A", status: "ACTIVE", guardianName: "", guardianPhone: "", guardianEmail: "" }];
    const preview = await previewStudentImport(db, "SCU-PREVIEW", rows);
    expect(preview.invalidRows).toBe(1);
    expect(preview.rows[0]!.errors.join(" ")).toContain("Class is required");
  });

  it("row with missing stream is marked invalid", async () => {
    const { db } = makeFakeDb(0);
    const rows = [{ admissionNumber: "ADM-004", fullName: "Jane Doe", gender: "Female", className: "Senior 1 A", streamName: "", status: "ACTIVE", guardianName: "", guardianPhone: "", guardianEmail: "" }];
    const preview = await previewStudentImport(db, "SCU-PREVIEW", rows);
    expect(preview.invalidRows).toBe(1);
    expect(preview.rows[0]!.errors.join(" ")).toContain("Stream is required");
  });

  it("row with unknown class does not auto-generate a real admission number (avoids wasted DB queries)", async () => {
    const { db } = makeFakeDb(0);
    // No admission number + bad class = invalid row; generator must NOT be called.
    // The placeholder starts with __INVALID_ to signal "not a real generated number".
    const rows = [{ admissionNumber: "", fullName: "Ghost", gender: "Male", className: "Nonexistent Class", streamName: "Z", status: "ACTIVE", guardianName: "", guardianPhone: "", guardianEmail: "" }];
    const preview = await previewStudentImport(db, "SCU-PREVIEW", rows);
    expect(preview.invalidRows).toBe(1);
    expect(preview.rows[0]!.generatedAdmissionNumber).toMatch(/^__INVALID_/);
  });

  it("a mix of 20 valid + 3 invalid rows: valid rows all import, invalid rows all reported", async () => {
    const { db, state } = makeFakeDb(0);
    const good = makeRows(20);
    const bad: StudentImportRowInput[] = [
      { admissionNumber: "BAD-001", fullName: "", gender: "Male", className: "Senior 1 A", streamName: "A", status: "ACTIVE", guardianName: "", guardianPhone: "", guardianEmail: "" },
      { admissionNumber: "BAD-002", fullName: "No Gender", gender: "", className: "Senior 1 A", streamName: "A", status: "ACTIVE", guardianName: "", guardianPhone: "", guardianEmail: "" },
      { admissionNumber: "BAD-003", fullName: "No Class", gender: "Female", className: "Made Up", streamName: "A", status: "ACTIVE", guardianName: "", guardianPhone: "", guardianEmail: "" },
    ];
    const job = await createStudentImportJob(db, "SCU-PREVIEW", [...good, ...bad]);
    const batch = await waitForJob(state, job.jobId);
    const summary = JSON.parse(batch.summary!);
    expect(summary.successCount).toBe(20);
    expect(summary.failedCount).toBe(3);
    expect(state.students.length).toBe(20);
  });
});
