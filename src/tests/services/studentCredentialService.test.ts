import { CredentialStatus, CredentialType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  deactivateStudentCredential,
  issueStudentCredential,
  normalizeCredentialUID,
  scanStudentCredential,
} from "../../server/services/studentCredentialService";

type StudentRow = {
  id: string;
  schoolId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  enrollments: Array<{ class: { name: string }; stream: { name: string } }>;
};

type CredentialRow = {
  id: string;
  schoolId: string;
  studentId: string;
  type: CredentialType;
  credentialUID: string;
  scanToken: string | null;
  status: CredentialStatus;
  issuedAt: Date;
  deactivatedAt: Date | null;
  deactivatedReason: string | null;
  issuedById: string | null;
  student: StudentRow;
};

function createMockDb() {
  const students: StudentRow[] = [
    {
      id: "student-a",
      schoolId: "school-a",
      admissionNumber: "A-001",
      firstName: "Ada",
      lastName: "Lovelace",
      isActive: true,
      enrollments: [{ class: { name: "Senior 1" }, stream: { name: "A" } }],
    },
    {
      id: "student-b",
      schoolId: "school-b",
      admissionNumber: "B-001",
      firstName: "Grace",
      lastName: "Hopper",
      isActive: true,
      enrollments: [{ class: { name: "Senior 2" }, stream: { name: "B" } }],
    },
    {
      id: "student-inactive",
      schoolId: "school-a",
      admissionNumber: "A-002",
      firstName: "Inactive",
      lastName: "Learner",
      isActive: false,
      enrollments: [{ class: { name: "Senior 1" }, stream: { name: "A" } }],
    },
  ];
  const credentials: CredentialRow[] = [];
  const auditLogs: unknown[] = [];

  function attachStudent(row: Omit<CredentialRow, "student">): CredentialRow {
    const student = students.find((item) => item.id === row.studentId);
    if (!student) throw new Error("student missing");
    return { ...row, student };
  }

  const db = {
    student: {
      findFirst: async ({ where }: { where: { id?: string; schoolId?: string } }) =>
        students.find((student) => student.id === where.id && student.schoolId === where.schoolId) ?? null,
    },
    studentCredential: {
      findUnique: async ({ where }: { where: { schoolId_type_credentialUID: { schoolId: string; type: CredentialType; credentialUID: string } } }) =>
        credentials.find(
          (credential) =>
            credential.schoolId === where.schoolId_type_credentialUID.schoolId
            && credential.type === where.schoolId_type_credentialUID.type
            && credential.credentialUID === where.schoolId_type_credentialUID.credentialUID,
        ) ?? null,
      findFirst: async ({ where }: { where: { id?: string; schoolId?: string } }) =>
        credentials.find((credential) => credential.id === where.id && credential.schoolId === where.schoolId) ?? null,
      findMany: async () => credentials,
      create: async ({ data }: { data: { schoolId: string; studentId: string; type: CredentialType; credentialUID: string; scanToken?: string | null; issuedById?: string | null } }) => {
        const row = attachStudent({
          id: `credential-${credentials.length + 1}`,
          schoolId: data.schoolId,
          studentId: data.studentId,
          type: data.type,
          credentialUID: data.credentialUID,
          scanToken: data.scanToken ?? null,
          status: CredentialStatus.ACTIVE,
          issuedAt: new Date("2026-06-21T08:00:00.000Z"),
          deactivatedAt: null,
          deactivatedReason: null,
          issuedById: data.issuedById ?? null,
        });
        credentials.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<CredentialRow> }) => {
        const index = credentials.findIndex((credential) => credential.id === where.id);
        if (index < 0) throw new Error("credential missing");
        const current = credentials[index];
        const merged = { ...current, ...data };
        const student = students.find((item) => item.id === merged.studentId);
        if (!student) throw new Error("student missing");
        const next = { ...merged, student };
        credentials[index] = next;
        return next;
      },
    },
    auditLog: {
      create: async ({ data }: { data: unknown }) => {
        auditLogs.push(data);
        return data;
      },
    },
  };

  return { db: db as never, credentials, auditLogs };
}

describe("studentCredentialService", () => {
  it("issues an NFC wristband to a student in the same school", async () => {
    const { db, auditLogs } = createMockDb();
    const result = await issueStudentCredential({ schoolId: "school-a", actorId: "user-a" }, { studentId: "student-a", credentialUID: " ab12 " }, db);

    expect(result.credential.credentialUID).toBe("AB12");
    expect(result.credential.scanToken).toEqual(expect.any(String));
    expect(result.credential.nfcUrl).toBe(`/nfc/t/${result.credential.scanToken}`);
    expect(result.credential.nfcUrl).not.toContain("/canteen/");
    expect(result.credential.student.name).toBe("Ada Lovelace");
    expect(auditLogs).toHaveLength(1);
  });

  it("rejects issue for a student outside the school", async () => {
    const { db } = createMockDb();
    await expect(issueStudentCredential({ schoolId: "school-a" }, { studentId: "student-b", credentialUID: "AB12" }, db)).rejects.toThrow(
      "Student not found for this school.",
    );
  });

  it("normalizes credential UIDs to uppercase", () => {
    expect(normalizeCredentialUID("  nfc-00ab  ")).toBe("NFC-00AB");
  });

  it("rejects a duplicate active wristband in the same school", async () => {
    const { db } = createMockDb();
    await issueStudentCredential({ schoolId: "school-a" }, { studentId: "student-a", credentialUID: "AB12" }, db);

    await expect(issueStudentCredential({ schoolId: "school-a" }, { studentId: "student-a", credentialUID: "ab12" }, db)).rejects.toThrow(
      "already active",
    );
  });

  it("requires a reason when deactivating a wristband", async () => {
    const { db } = createMockDb();
    const issued = await issueStudentCredential({ schoolId: "school-a" }, { studentId: "student-a", credentialUID: "AB12" }, db);

    await expect(deactivateStudentCredential({ schoolId: "school-a" }, issued.credential.id, " ", db)).rejects.toThrow(
      "Deactivation reason is required.",
    );
  });

  it("returns DEACTIVATED when a deactivated wristband is scanned", async () => {
    const { db } = createMockDb();
    const issued = await issueStudentCredential({ schoolId: "school-a" }, { studentId: "student-a", credentialUID: "AB12" }, db);
    await deactivateStudentCredential({ schoolId: "school-a" }, issued.credential.id, "Lost", db);

    await expect(scanStudentCredential({ schoolId: "school-a" }, { credentialUID: "AB12" }, db)).resolves.toMatchObject({
      status: "DEACTIVATED",
    });
  });

  it("returns NOT_FOUND for an unknown wristband", async () => {
    const { db } = createMockDb();
    await expect(scanStudentCredential({ schoolId: "school-a" }, { credentialUID: "NOPE" }, db)).resolves.toEqual({ status: "NOT_FOUND" });
  });

  it("returns safe student details for an active wristband scan", async () => {
    const { db } = createMockDb();
    await issueStudentCredential({ schoolId: "school-a" }, { studentId: "student-a", credentialUID: "AB12" }, db);

    const result = await scanStudentCredential({ schoolId: "school-a" }, { credentialUID: "AB12" }, db);
    expect(result).toMatchObject({
      status: "ACTIVE",
      student: {
        id: "student-a",
        name: "Ada Lovelace",
        admissionNumber: "A-001",
        className: "Senior 1",
        streamName: "A",
      },
    });
    expect(result.student).not.toHaveProperty("guardianContacts");
    expect(result.student).not.toHaveProperty("walletBalance");
  });

  it("returns STUDENT_INACTIVE when a registered student's record is inactive", async () => {
    const { db, credentials } = createMockDb();
    credentials.push({
      id: "credential-inactive",
      schoolId: "school-a",
      studentId: "student-inactive",
      type: CredentialType.NFC_WRISTBAND,
      credentialUID: "INACTIVE1",
      scanToken: "neutral-token-inactive",
      status: CredentialStatus.ACTIVE,
      issuedAt: new Date("2026-06-21T08:00:00.000Z"),
      deactivatedAt: null,
      deactivatedReason: null,
      issuedById: null,
      student: {
        id: "student-inactive",
        schoolId: "school-a",
        admissionNumber: "A-002",
        firstName: "Inactive",
        lastName: "Learner",
        isActive: false,
        enrollments: [{ class: { name: "Senior 1" }, stream: { name: "A" } }],
      },
    });

    await expect(scanStudentCredential({ schoolId: "school-a" }, { credentialUID: "INACTIVE1" }, db)).resolves.toMatchObject({
      status: "STUDENT_INACTIVE",
      student: { id: "student-inactive" },
    });
  });

  it("keeps wristband scans isolated by school", async () => {
    const { db } = createMockDb();
    await issueStudentCredential({ schoolId: "school-a" }, { studentId: "student-a", credentialUID: "AB12" }, db);

    await expect(scanStudentCredential({ schoolId: "school-b" }, { credentialUID: "AB12" }, db)).resolves.toEqual({ status: "NOT_FOUND" });
  });

  it("requires school context so creator-only callers cannot use the module", async () => {
    const { db } = createMockDb();
    await expect(scanStudentCredential({ actorId: "creator-a" }, { credentialUID: "AB12" }, db)).rejects.toThrow("School context required.");
  });
});
