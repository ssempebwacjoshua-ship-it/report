import { CredentialStatus, CredentialType } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetReaderCredentialCaptureSessionsForTests,
  captureReaderCredentialFromReader,
  confirmReaderCredentialLink,
  getReaderCredentialCapture,
  startReaderCredentialCapture,
  transferReaderCredentialLink,
} from "../../server/services/readerCredentialLinkService";

type MockTag = {
  id: string;
  schoolId: string;
  publicCode: string;
  label: string | null;
  physicalUid: string | null;
  status: string;
  studentId: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
  } | null;
};

type MockCredential = {
  id: string;
  schoolId: string;
  studentId: string;
  type: CredentialType;
  status: CredentialStatus;
  credentialUID: string;
  scanToken: string | null;
  issuedAt: Date;
  deactivatedAt: Date | null;
  deactivatedReason: string | null;
  issuedById: string | null;
};

function createMockDb() {
  const tags: MockTag[] = [
    {
      id: "tag-1",
      schoolId: "school-1",
      publicCode: "PUBCODE1234567890",
      label: "Student Wristband 1",
      physicalUid: null,
      status: "ASSIGNED",
      studentId: "student-1",
      student: {
        id: "student-1",
        firstName: "Jane",
        lastName: "Doe",
        admissionNumber: "A001",
      },
    },
    {
      id: "tag-2",
      schoolId: "school-1",
      publicCode: "PUBCODE0987654321",
      label: "Student Wristband 2",
      physicalUid: "OTHER-CANONICAL",
      status: "ASSIGNED",
      studentId: "student-2",
      student: {
        id: "student-2",
        firstName: "John",
        lastName: "Smith",
        admissionNumber: "A002",
      },
    },
  ];

  const credentials: MockCredential[] = [];
  const auditLogs: Array<Record<string, unknown>> = [];
  const devices = [
    {
      id: "device-1",
      schoolId: "school-1",
      name: "Attendance Gate 01",
      deviceKey: "attendance-gate-01",
      mode: "ATTENDANCE",
      location: "Main Entrance",
      locationName: "Main Entrance",
      isActive: true,
      status: "ACTIVE",
    },
  ];

  const db = {
    nfcTag: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        return tags.find((tag) => {
          if (where.id && tag.id !== where.id) return false;
          if (where.schoolId && tag.schoolId !== where.schoolId) return false;
          if (where.studentId && tag.studentId !== where.studentId) return false;
          if (where.status && tag.status !== where.status) return false;
          if (where.physicalUid && typeof where.physicalUid === "object" && "in" in where.physicalUid) {
            const values = (where.physicalUid as { in: string[] }).in;
            if (!tag.physicalUid || !values.includes(tag.physicalUid)) return false;
          }
          if (where.id && typeof where.id === "object" && "not" in where.id && tag.id === (where.id as { not: string }).not) return false;
          return true;
        }) ?? null;
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        return tags.filter((tag) => {
          if (where.schoolId && tag.schoolId !== where.schoolId) return false;
          if (where.studentId && tag.studentId !== where.studentId) return false;
          if (where.OR && Array.isArray(where.OR)) {
            return where.OR.some((entry: Record<string, unknown>) =>
              entry.physicalUid
                ? !!tag.physicalUid && tag.physicalUid === (entry.physicalUid as { equals: string }).equals
                : false);
          }
          return true;
        });
      },
      update: async ({ where, data, include }: { where: { id: string }; data: Partial<MockTag>; include?: Record<string, unknown> }) => {
        const tag = tags.find((entry) => entry.id === where.id);
        if (!tag) throw new Error("tag missing");
        Object.assign(tag, data);
        if (include?.student) {
          return tag;
        }
        return tag;
      },
    },
    studentCredential: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        return credentials.find((credential) => {
          if (where.schoolId && credential.schoolId !== where.schoolId) return false;
          if (where.studentId && typeof where.studentId === "string" && credential.studentId !== where.studentId) return false;
          if (where.studentId && typeof where.studentId === "object" && "not" in where.studentId && credential.studentId === (where.studentId as { not: string }).not) return false;
          if (where.type && credential.type !== where.type) return false;
          if (where.status && credential.status !== where.status) return false;
          if (where.credentialUID && typeof where.credentialUID === "object" && "in" in where.credentialUID) {
            if (!(where.credentialUID as { in: string[] }).in.includes(credential.credentialUID)) return false;
          }
          return true;
        }) ?? null;
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        return credentials
          .filter((credential) => {
            if (where.schoolId && credential.schoolId !== where.schoolId) return false;
            if (where.studentId && typeof where.studentId === "string" && credential.studentId !== where.studentId) return false;
            if (where.studentId && typeof where.studentId === "object" && "not" in where.studentId && credential.studentId === (where.studentId as { not: string }).not) return false;
            if (where.type && credential.type !== where.type) return false;
            if (where.status && credential.status !== where.status) return false;
            if (where.credentialUID && typeof where.credentialUID === "object" && "in" in where.credentialUID) {
              if (!(where.credentialUID as { in: string[] }).in.includes(credential.credentialUID)) return false;
            }
            return true;
          })
          .map((credential) => ({
            ...credential,
            student: tags.find((tag) => tag.studentId === credential.studentId)?.student,
          }));
      },
      create: async ({ data }: { data: Omit<MockCredential, "id" | "issuedAt" | "deactivatedAt" | "deactivatedReason" | "status"> }) => {
        const row: MockCredential = {
          id: `cred-${credentials.length + 1}`,
          schoolId: data.schoolId,
          studentId: data.studentId,
          type: data.type,
          status: CredentialStatus.ACTIVE,
          credentialUID: data.credentialUID,
          scanToken: data.scanToken,
          issuedAt: new Date("2026-07-12T08:00:00.000Z"),
          deactivatedAt: null,
          deactivatedReason: null,
          issuedById: data.issuedById ?? null,
        };
        credentials.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<MockCredential> }) => {
        const row = credentials.find((credential) => credential.id === where.id);
        if (!row) throw new Error("credential missing");
        Object.assign(row, data);
        return row;
      },
    },
    nfcOfflineDevice: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        return devices.find((device) => {
          if (where.schoolId && device.schoolId !== where.schoolId) return false;
          if (where.OR && Array.isArray(where.OR)) {
            return where.OR.some((entry: Record<string, unknown>) =>
              (entry.id && device.id === entry.id) || (entry.deviceKey && device.deviceKey === entry.deviceKey));
          }
          return true;
        }) ?? null;
      },
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        auditLogs.push(data);
        return data;
      },
    },
    $transaction: async <T>(fn: (tx: typeof db) => Promise<T>) => fn(db),
  };

  return { db: db as never, tags, credentials, auditLogs, devices };
}

describe("readerCredentialLinkService", () => {
  beforeEach(() => {
    __resetReaderCredentialCaptureSessionsForTests();
  });

  it("starts a tenant-scoped capture for an assigned wristband", async () => {
    const { db, auditLogs } = createMockDb();

    const result = await startReaderCredentialCapture(
      { schoolId: "school-1", actorId: "admin-1", role: "ADMIN_OPERATOR" },
      { tagId: "tag-1", deviceId: "device-1" },
      db,
    );

    expect(result.status).toBe("PENDING");
    expect(result.tag.student.name).toBe("Jane Doe");
    expect(result.deviceLabel).toBe("Main Entrance");
    expect(auditLogs.some((entry) => entry.action === "nfc_tag.reader_capture_started")).toBe(true);
  });

  it("captures and atomically links a reader credential without changing the public payload", async () => {
    const { db, tags, credentials, devices, auditLogs } = createMockDb();

    const started = await startReaderCredentialCapture(
      { schoolId: "school-1", actorId: "admin-1", role: "ADMIN_OPERATOR" },
      { tagId: "tag-1", deviceId: "device-1" },
      db,
    );

    const captured = await captureReaderCredentialFromReader(devices[0], {
      credential: "786777",
      rawWiegandDecimal: "35128677",
      rawWiegandHex: "02180565",
      facilityCode: "12",
      cardNumber: "1",
    });

    expect(captured?.status).toBe("CAPTURED");
    expect(captured?.preview?.maskedCanonicalCredential).toBeTruthy();

    const confirmed = await confirmReaderCredentialLink(
      { schoolId: "school-1", actorId: "admin-1", role: "ADMIN_OPERATOR" },
      started.captureId,
      db,
    );

    expect(confirmed.ok).toBe(true);
    expect(tags[0].physicalUid).toBe("35128677");
    expect(tags[0].publicCode).toBe("PUBCODE1234567890");
    expect(credentials[0]).toMatchObject({
      studentId: "student-1",
      credentialUID: "35128677",
      type: CredentialType.NFC_WRISTBAND,
      status: CredentialStatus.ACTIVE,
    });
    expect(auditLogs.some((entry) => entry.action === "nfc_tag.reader_credential_linked")).toBe(true);
  });

  it("returns a genuine same-wristband conflict when the strong raw Wiegand identity is already active for another student", async () => {
    const { db, devices, credentials } = createMockDb();
    credentials.push({
      id: "cred-existing",
      schoolId: "school-1",
      studentId: "student-2",
      type: CredentialType.NFC_WRISTBAND,
      status: CredentialStatus.ACTIVE,
      credentialUID: "35128677",
      scanToken: "tok-1",
      issuedAt: new Date("2026-07-12T08:00:00.000Z"),
      deactivatedAt: null,
      deactivatedReason: null,
      issuedById: null,
    });

    const started = await startReaderCredentialCapture(
      { schoolId: "school-1", actorId: "admin-1", role: "ADMIN_OPERATOR" },
      { tagId: "tag-1", deviceId: "device-1" },
      db,
    );

    await captureReaderCredentialFromReader(devices[0], {
      credential: "786777",
      rawWiegandDecimal: "35128677",
      rawWiegandHex: "02180565",
      facilityCode: "12",
      cardNumber: "1",
    });

    await expect(confirmReaderCredentialLink(
      { schoolId: "school-1", actorId: "admin-1", role: "ADMIN_OPERATOR" },
      started.captureId,
      db,
    )).rejects.toMatchObject({
      status: 409,
      code: "READER_CREDENTIAL_CONFLICT",
      conflict: expect.objectContaining({
        previousStudent: expect.objectContaining({ name: "John Smith" }),
        matchedAliasStrength: "STRONG",
        matchedAliasSource: "rawWiegandDecimal",
      }),
    });
  });

  it("does not block a distinct raw Wiegand UID on a weak credential alias collision", async () => {
    const { db, devices, credentials } = createMockDb();
    credentials.push({
      id: "cred-existing",
      schoolId: "school-1",
      studentId: "student-2",
      type: CredentialType.NFC_WRISTBAND,
      status: CredentialStatus.ACTIVE,
      credentialUID: "786777",
      scanToken: "tok-1",
      issuedAt: new Date("2026-07-12T08:00:00.000Z"),
      deactivatedAt: null,
      deactivatedReason: null,
      issuedById: null,
    });

    const started = await startReaderCredentialCapture(
      { schoolId: "school-1", actorId: "admin-1", role: "ADMIN_OPERATOR" },
      { tagId: "tag-1", deviceId: "device-1" },
      db,
    );

    await captureReaderCredentialFromReader(devices[0], {
      credential: "786777",
      rawWiegandDecimal: "35128677",
      rawWiegandHex: "02180565",
      facilityCode: "12",
      cardNumber: "1",
    });

    const confirmed = await confirmReaderCredentialLink(
      { schoolId: "school-1", actorId: "admin-1", role: "ADMIN_OPERATOR" },
      started.captureId,
      db,
    );

    expect(confirmed.ok).toBe(true);
  });

  it("requires admin role and reason to transfer a reader credential", async () => {
    const { db, devices, credentials } = createMockDb();
    credentials.push({
      id: "cred-existing",
      schoolId: "school-1",
      studentId: "student-2",
      type: CredentialType.NFC_WRISTBAND,
      status: CredentialStatus.ACTIVE,
      credentialUID: "35128677",
      scanToken: "tok-1",
      issuedAt: new Date("2026-07-12T08:00:00.000Z"),
      deactivatedAt: null,
      deactivatedReason: null,
      issuedById: null,
    });

    const started = await startReaderCredentialCapture(
      { schoolId: "school-1", actorId: "admin-1", role: "ADMIN_OPERATOR" },
      { tagId: "tag-1", deviceId: "device-1" },
      db,
    );

    await captureReaderCredentialFromReader(devices[0], {
      credential: "786777",
      rawWiegandDecimal: "35128677",
      rawWiegandHex: "02180565",
      facilityCode: "12",
      cardNumber: "1",
    });

    await expect(transferReaderCredentialLink(
      { schoolId: "school-1", actorId: "staff-1", role: "TEACHER" },
      started.captureId,
      "Reassigned by office",
      db,
    )).rejects.toMatchObject({ status: 403 });

    await expect(transferReaderCredentialLink(
      { schoolId: "school-1", actorId: "admin-1", role: "ADMIN_OPERATOR" },
      started.captureId,
      "   ",
      db,
    )).rejects.toMatchObject({ status: 400 });
  });

  it("transfers the credential atomically, deactivates the previous credential, and preserves unrelated history", async () => {
    const { db, devices, credentials, tags, auditLogs } = createMockDb();
    credentials.push({
      id: "cred-existing",
      schoolId: "school-1",
      studentId: "student-2",
      type: CredentialType.NFC_WRISTBAND,
      status: CredentialStatus.ACTIVE,
      credentialUID: "35128677",
      scanToken: "tok-1",
      issuedAt: new Date("2026-07-12T08:00:00.000Z"),
      deactivatedAt: null,
      deactivatedReason: null,
      issuedById: null,
    });
    tags[1].physicalUid = "35128677";

    const started = await startReaderCredentialCapture(
      { schoolId: "school-1", actorId: "admin-1", role: "ADMIN_OPERATOR" },
      { tagId: "tag-1", deviceId: "device-1" },
      db,
    );

    await captureReaderCredentialFromReader(devices[0], {
      credential: "786777",
      rawWiegandDecimal: "35128677",
      rawWiegandHex: "02180565",
      facilityCode: "12",
      cardNumber: "1",
    });

    const transferred = await transferReaderCredentialLink(
      { schoolId: "school-1", actorId: "admin-1", role: "ADMIN_OPERATOR" },
      started.captureId,
      "Student received reassigned wristband",
      db,
    );

    expect(transferred.ok).toBe(true);
    expect(credentials.find((credential) => credential.id === "cred-existing")).toMatchObject({
      status: CredentialStatus.DEACTIVATED,
      deactivatedReason: "Student received reassigned wristband",
    });
    expect(tags[1].physicalUid).toBeNull();
    expect(tags[0].physicalUid).toBe("35128677");
    expect(auditLogs.some((entry) => entry.action === "nfc_tag.reader_credential_transferred")).toBe(true);
  });

  it("denies cross-school transfer access", async () => {
    const { db, devices, credentials } = createMockDb();
    credentials.push({
      id: "cred-existing",
      schoolId: "school-1",
      studentId: "student-2",
      type: CredentialType.NFC_WRISTBAND,
      status: CredentialStatus.ACTIVE,
      credentialUID: "35128677",
      scanToken: "tok-1",
      issuedAt: new Date("2026-07-12T08:00:00.000Z"),
      deactivatedAt: null,
      deactivatedReason: null,
      issuedById: null,
    });

    const started = await startReaderCredentialCapture(
      { schoolId: "school-1", actorId: "admin-1", role: "ADMIN_OPERATOR" },
      { tagId: "tag-1", deviceId: "device-1" },
      db,
    );

    await captureReaderCredentialFromReader(devices[0], {
      credential: "786777",
      rawWiegandDecimal: "35128677",
      rawWiegandHex: "02180565",
      facilityCode: "12",
      cardNumber: "1",
    });

    await expect(transferReaderCredentialLink(
      { schoolId: "school-2", actorId: "admin-1", role: "ADMIN_OPERATOR" },
      started.captureId,
      "Cross-school transfer attempt",
      db,
    )).rejects.toMatchObject({ status: 404 });
  });

  it("keeps capture sessions tenant-scoped when loading status", async () => {
    const { db } = createMockDb();
    const started = await startReaderCredentialCapture(
      { schoolId: "school-1", actorId: "admin-1", role: "ADMIN_OPERATOR" },
      { tagId: "tag-1", deviceId: "device-1" },
      db,
    );

    await expect(getReaderCredentialCapture(
      { schoolId: "school-2", actorId: "admin-2", role: "ADMIN_OPERATOR" },
      started.captureId,
    )).rejects.toMatchObject({ status: 404 });
  });
});
