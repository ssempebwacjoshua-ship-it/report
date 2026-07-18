import { describe, expect, it, vi } from "vitest";
import {
  cancelStudentPassOut,
  createStudentPassOut,
  listStudentPassOuts,
  searchPassOutStudents,
} from "../../server/services/nfcPassOutService";

const ADMIN_CTX = { schoolId: "school-a", actorId: "admin-a", role: "ADMIN_OPERATOR" as const };
const GATE_CTX = { schoolId: "school-a", actorId: "gate-a", role: "GATE_SECURITY" as const };

function createDb() {
  const student = {
    id: "student-a",
    schoolId: "school-a",
    admissionNumber: "A-001",
    firstName: "Ada",
    lastName: "Lovelace",
    studentType: "DAY" as const,
    isActive: true,
    enrollments: [{ class: { name: "Senior 1" }, stream: { name: "A" } }],
  };
  const passOuts: Array<Record<string, unknown>> = [];

  const db = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
    student: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (where.id === "student-a" && where.schoolId === "school-a") return student;
        return null;
      }),
      findMany: vi.fn(async () => [student]),
    },
    studentPassOut: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, any> }) => {
        if (where.id) {
          return passOuts.find((row) => row.id === where.id && row.schoolId === where.schoolId) ?? null;
        }
        if (where.studentId === "student-a" && where.schoolId === "school-a" && passOuts.length > 0) {
          const activeStatuses = where.status?.in as string[] | undefined;
          return passOuts.find((row) =>
            row.studentId === "student-a"
            && (!activeStatuses || activeStatuses.includes(String(row.status)))
            && row.cancelledAt == null,
          ) ?? null;
        }
        return null;
      }),
      findMany: vi.fn(async () => passOuts),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `passout-${passOuts.length + 1}`,
          ...data,
          createdAt: new Date("2026-07-18T09:00:00.000Z"),
          updatedAt: new Date("2026-07-18T09:00:00.000Z"),
          student,
          checkedOutAt: null,
          checkedInAt: null,
          cancelledAt: null,
          cancellationReason: null,
          checkoutMovementEventId: null,
          checkinMovementEventId: null,
        };
        passOuts.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const index = passOuts.findIndex((row) => row.id === where.id);
        const updated = {
          ...passOuts[index],
          ...data,
          updatedAt: new Date("2026-07-18T10:00:00.000Z"),
          student,
        };
        passOuts[index] = updated;
        return updated;
      }),
    },
    auditLog: {
      create: vi.fn(async () => ({})),
    },
  };

  return { db: db as never, passOuts };
}

describe("nfcPassOutService", () => {
  it("creates an approved pass-out for a student in the current school", async () => {
    const { db, passOuts } = createDb();

    const result = await createStudentPassOut(ADMIN_CTX, {
      studentId: "student-a",
      reason: "Medical appointment",
      activeFrom: "2026-07-19T10:00:00.000Z",
      activeUntil: "2026-07-19T12:00:00.000Z",
    }, db);

    expect(result.passOut.status).toBe("APPROVED");
    expect(result.passOut.student.studentName).toBe("Ada Lovelace");
    expect(passOuts).toHaveLength(1);
  });

  it("blocks overlapping approved pass-outs for the same student", async () => {
    const { db, passOuts } = createDb();
    passOuts.push({
      id: "passout-1",
      schoolId: "school-a",
      studentId: "student-a",
      status: "APPROVED",
      reason: "Earlier pass-out",
      approvedAt: new Date("2026-07-18T08:00:00.000Z"),
      activeFrom: new Date("2026-07-18T10:00:00.000Z"),
      activeUntil: new Date("2026-07-18T12:00:00.000Z"),
      cancelledAt: null,
      createdAt: new Date("2026-07-18T08:00:00.000Z"),
      updatedAt: new Date("2026-07-18T08:00:00.000Z"),
      student: {
        id: "student-a",
        admissionNumber: "A-001",
        firstName: "Ada",
        lastName: "Lovelace",
        studentType: "DAY",
        enrollments: [{ class: { name: "Senior 1" }, stream: { name: "A" } }],
      },
    });

    await expect(createStudentPassOut(ADMIN_CTX, {
      studentId: "student-a",
      reason: "Medical appointment",
      activeFrom: "2026-07-18T11:00:00.000Z",
      activeUntil: "2026-07-18T13:00:00.000Z",
    }, db)).rejects.toMatchObject({ status: 409 });
  });

  it("cancels an approved pass-out with an audit-safe reason", async () => {
    const { db, passOuts } = createDb();
    passOuts.push({
      id: "passout-1",
      schoolId: "school-a",
      studentId: "student-a",
      status: "APPROVED",
      reason: "Medical appointment",
      approvedAt: new Date("2026-07-18T08:00:00.000Z"),
      activeFrom: new Date("2026-07-18T10:00:00.000Z"),
      activeUntil: new Date("2026-07-18T12:00:00.000Z"),
      checkedOutAt: null,
      checkedInAt: null,
      cancelledAt: null,
      cancellationReason: null,
      createdByUserId: "admin-a",
      approvedByUserId: "admin-a",
      cancelledByUserId: null,
      checkoutMovementEventId: null,
      checkinMovementEventId: null,
      createdAt: new Date("2026-07-18T08:00:00.000Z"),
      updatedAt: new Date("2026-07-18T08:00:00.000Z"),
      student: {
        id: "student-a",
        admissionNumber: "A-001",
        firstName: "Ada",
        lastName: "Lovelace",
        studentType: "DAY",
        enrollments: [{ class: { name: "Senior 1" }, stream: { name: "A" } }],
      },
    });

    const result = await cancelStudentPassOut(ADMIN_CTX, "passout-1", "Parent changed plan", db);

    expect(result.passOut.status).toBe("CANCELLED");
    expect(result.passOut.cancellationReason).toBe("Parent changed plan");
  });

  it("keeps pass-out management admin-only", async () => {
    const { db } = createDb();

    await expect(searchPassOutStudents(GATE_CTX, {}, db)).rejects.toMatchObject({ status: 403 });
    await expect(listStudentPassOuts(GATE_CTX, {}, db)).rejects.toMatchObject({ status: 403 });
  });
});
