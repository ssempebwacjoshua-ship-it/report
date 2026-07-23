import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveStudentByIdentifierMock = vi.hoisted(() => vi.fn());
const linkReaderCredentialToAssignedTagMock = vi.hoisted(() => vi.fn());

vi.mock("../../server/services/nfcTagsService", async () => {
  const actual = await vi.importActual<typeof import("../../server/services/nfcTagsService")>("../../server/services/nfcTagsService");
  return {
    ...actual,
    resolveStudentByIdentifier: resolveStudentByIdentifierMock,
  };
});

vi.mock("../../server/services/readerCredentialLinkService", () => ({
  linkReaderCredentialToAssignedTag: linkReaderCredentialToAssignedTagMock,
}));

import {
  createNfcTagWriteCommand,
  processReaderTagWriteCommandCallback,
} from "../../server/services/nfcTagWriteCommandService";

function buildDb(overrides: Record<string, any> = {}) {
  const db = {
    nfcOfflineDevice: {
      findFirst: vi.fn(),
    },
    readerDeviceCommand: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    nfcTag: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: async <T>(fn: (tx: any) => Promise<T>) => fn(db),
    ...overrides,
  };
  return db;
}

describe("nfcTagWriteCommandService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveStudentByIdentifierMock.mockResolvedValue({
      id: "student-1",
      admissionNumber: "ADM-001",
      firstName: "Claire",
      lastName: "Nakibuuka",
    });
    linkReaderCredentialToAssignedTagMock.mockResolvedValue({
      credentialId: "cred-1",
      canonicalCredential: "WB-123456",
    });
  });

  it("creates a write command with the exact SCNFC payload for the selected controller", async () => {
    const db = buildDb();
    db.nfcOfflineDevice.findFirst.mockResolvedValue({
      id: "device-1",
      schoolId: "school-1",
      name: "Gate Reader",
      deviceKey: "gate-reader-1",
      mode: "ATTENDANCE",
      location: "Main Entrance",
      locationName: "Main Entrance",
      locationType: "GATE",
      attendanceMode: "GATE_ATTENDANCE",
      isActive: true,
      status: "ACTIVE",
      onlineStatus: "ONLINE",
      lastSeenAt: new Date(),
      lastHeartbeatAt: new Date(),
    });
    db.readerDeviceCommand.findFirst.mockResolvedValue(null);
    db.nfcTag.create.mockImplementation(async ({ data }: { data: Record<string, any> }) => ({
      id: "tag-1",
      schoolId: "school-1",
      publicCode: data.publicCode,
      physicalUid: null,
      tagMode: "TEXT",
      label: null,
      status: "ASSIGNED",
      studentId: "student-1",
      writtenUrl: data.writtenUrl,
      writtenPayload: data.writtenPayload,
      writtenAt: null,
      verifiedAt: null,
      assignedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      student: {
        id: "student-1",
        admissionNumber: "ADM-001",
        firstName: "Claire",
        lastName: "Nakibuuka",
      },
    }));
    db.readerDeviceCommand.create.mockImplementation(async ({ data }: { data: Record<string, any> }) => ({
      id: "command-1",
      schoolId: "school-1",
      deviceId: "device-1",
      type: "WRITE_NFC_TAG_PAYLOAD",
      status: "PENDING",
      payloadJson: data.payloadJson,
      targetTagId: data.targetTagId,
      targetStudentId: data.targetStudentId,
      expectedPayload: data.expectedPayload,
      writtenPayload: null,
      readbackPayload: null,
      credentialJson: null,
      credentialStatus: "PENDING",
      credentialError: null,
      sentAt: null,
      writeStartedAt: null,
      writeCompletedAt: null,
      verifyStartedAt: null,
      verifiedAt: null,
      failedAt: null,
      credentialLinkedAt: null,
      errorMessage: null,
      requestedByUserId: "admin-1",
      requestedAt: new Date(),
      ackedAt: null,
      completedAt: null,
      lastStatusAt: new Date(),
      lastStatusMessage: "queued",
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = await createNfcTagWriteCommand({
      schoolId: "school-1",
      actorId: "admin-1",
      role: "ADMIN_OPERATOR",
    }, {
      controllerId: "device-1",
      studentId: "student-1",
      baseUrl: "https://app.schoolconnect.test",
    }, db as never);

    expect(result.payload.payload).toMatch(/^SCNFC:/);
    expect(result.payload.payload).toBe(`SCNFC:${result.payload.publicCode}`);
    expect(db.readerDeviceCommand.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        deviceId: "device-1",
        type: "WRITE_NFC_TAG_PAYLOAD",
        expectedPayload: `SCNFC:${result.payload.publicCode}`,
        payloadJson: expect.objectContaining({
          payload: `SCNFC:${result.payload.publicCode}`,
          format: "NDEF_TEXT",
          verifyAfterWrite: true,
          captureReaderCredential: true,
        }),
      }),
    }));
  });

  it("marks the tag WRITTEN only after a successful write callback", async () => {
    const db = buildDb();
    let currentCommand = {
      id: "command-1",
      schoolId: "school-1",
      deviceId: "device-1",
      type: "WRITE_NFC_TAG_PAYLOAD",
      status: "WRITING",
      payloadJson: {
        tagId: "tag-1",
        studentId: "student-1",
        publicCode: "public-1",
        payload: "SCNFC:public-1",
        format: "NDEF_TEXT",
        verifyAfterWrite: true,
        captureReaderCredential: true,
      },
      targetTagId: "tag-1",
      targetStudentId: "student-1",
      expectedPayload: "SCNFC:public-1",
      writtenPayload: null,
      readbackPayload: null,
      credentialJson: null,
      credentialStatus: "PENDING",
      credentialError: null,
      sentAt: new Date(),
      writeStartedAt: new Date(),
      writeCompletedAt: null,
      verifyStartedAt: null,
      verifiedAt: null,
      failedAt: null,
      credentialLinkedAt: null,
      errorMessage: null,
      requestedByUserId: "admin-1",
      requestedAt: new Date(),
      ackedAt: null,
      completedAt: null,
      lastStatusAt: new Date(),
      lastStatusMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.readerDeviceCommand.findFirst.mockImplementation(async () => currentCommand);
    db.nfcTag.findFirst.mockResolvedValue({
      id: "tag-1",
      schoolId: "school-1",
      publicCode: "public-1",
      physicalUid: null,
      tagMode: "TEXT",
      label: null,
      status: "ASSIGNED",
      studentId: "student-1",
      writtenUrl: "https://app/t/public-1",
      writtenPayload: "SCNFC:public-1",
      writtenAt: null,
      verifiedAt: null,
      assignedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      student: {
        id: "student-1",
        admissionNumber: "ADM-001",
        firstName: "Claire",
        lastName: "Nakibuuka",
      },
    });
    db.nfcTag.update.mockImplementation(async ({ data }: { data: Record<string, any> }) => ({
      id: "tag-1",
      schoolId: "school-1",
      publicCode: "public-1",
      physicalUid: null,
      tagMode: "TEXT",
      label: null,
      status: data.status,
      studentId: "student-1",
      writtenUrl: "https://app/t/public-1",
      writtenPayload: data.writtenPayload,
      writtenAt: data.writtenAt,
      verifiedAt: null,
      assignedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      student: {
        id: "student-1",
        admissionNumber: "ADM-001",
        firstName: "Claire",
        lastName: "Nakibuuka",
      },
    }));
    db.readerDeviceCommand.update.mockImplementation(async ({ data }: { data: Record<string, any> }) => {
      currentCommand = {
        ...currentCommand,
        ...data,
        updatedAt: new Date(),
      };
      return currentCommand;
    });

    const result = await processReaderTagWriteCommandCallback({
      id: "device-1",
      schoolId: "school-1",
      deviceKey: "gate-reader-1",
      name: "Gate Reader",
    }, {
      commandId: "command-1",
      deviceId: "device-1",
      status: "WRITTEN",
      writtenPayload: "SCNFC:public-1",
      credentialUID: "WB-123456",
    }, db as never);

    expect(db.nfcTag.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "WRITTEN" }),
    }));
    expect(result.status).toBe("WRITTEN");
    expect(result.mobilePayloadStatus).toBe("written");
  });

  it("marks the tag VERIFIED only after a matching readback payload", async () => {
    const db = buildDb();
    let currentCommand = {
      id: "command-1",
      schoolId: "school-1",
      deviceId: "device-1",
      type: "WRITE_NFC_TAG_PAYLOAD",
      status: "VERIFYING",
      payloadJson: {
        tagId: "tag-1",
        studentId: "student-1",
        publicCode: "public-1",
        payload: "SCNFC:public-1",
        format: "NDEF_TEXT",
        verifyAfterWrite: true,
        captureReaderCredential: true,
      },
      targetTagId: "tag-1",
      targetStudentId: "student-1",
      expectedPayload: "SCNFC:public-1",
      writtenPayload: "SCNFC:public-1",
      readbackPayload: null,
      credentialJson: null,
      credentialStatus: "PENDING",
      credentialError: null,
      sentAt: new Date(),
      writeStartedAt: new Date(),
      writeCompletedAt: new Date(),
      verifyStartedAt: new Date(),
      verifiedAt: null,
      failedAt: null,
      credentialLinkedAt: null,
      errorMessage: null,
      requestedByUserId: "admin-1",
      requestedAt: new Date(),
      ackedAt: null,
      completedAt: null,
      lastStatusAt: new Date(),
      lastStatusMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.readerDeviceCommand.findFirst.mockImplementation(async () => currentCommand);
    db.nfcTag.findFirst.mockResolvedValue({
      id: "tag-1",
      schoolId: "school-1",
      publicCode: "public-1",
      physicalUid: null,
      tagMode: "TEXT",
      label: null,
      status: "WRITTEN",
      studentId: "student-1",
      writtenUrl: "https://app/t/public-1",
      writtenPayload: "SCNFC:public-1",
      writtenAt: new Date(),
      verifiedAt: null,
      assignedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      student: {
        id: "student-1",
        admissionNumber: "ADM-001",
        firstName: "Claire",
        lastName: "Nakibuuka",
      },
    });
    db.nfcTag.update.mockImplementation(async ({ data }: { data: Record<string, any> }) => ({
      id: "tag-1",
      schoolId: "school-1",
      publicCode: "public-1",
      physicalUid: null,
      tagMode: "TEXT",
      label: null,
      status: data.status,
      studentId: "student-1",
      writtenUrl: "https://app/t/public-1",
      writtenPayload: data.writtenPayload,
      writtenAt: new Date(),
      verifiedAt: data.verifiedAt,
      assignedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      student: {
        id: "student-1",
        admissionNumber: "ADM-001",
        firstName: "Claire",
        lastName: "Nakibuuka",
      },
    }));
    db.readerDeviceCommand.update.mockImplementation(async ({ data }: { data: Record<string, any> }) => {
      currentCommand = {
        ...currentCommand,
        ...data,
        updatedAt: new Date(),
      };
      return currentCommand;
    });

    const result = await processReaderTagWriteCommandCallback({
      id: "device-1",
      schoolId: "school-1",
      deviceKey: "gate-reader-1",
      name: "Gate Reader",
    }, {
      commandId: "command-1",
      deviceId: "device-1",
      status: "VERIFIED",
      readbackPayload: "SCNFC:public-1",
      credentialUID: "WB-123456",
    }, db as never);

    expect(db.nfcTag.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "VERIFIED" }),
    }));
    expect(result.status).toBe("VERIFIED");
    expect(result.mobilePayloadStatus).toBe("verified");
    expect(result.readerCredentialStatus).toBe("linked");
  });

  it("fails verification when the readback payload does not match the expected SCNFC payload", async () => {
    const db = buildDb();
    db.readerDeviceCommand.findFirst.mockResolvedValue({
      id: "command-1",
      schoolId: "school-1",
      deviceId: "device-1",
      type: "WRITE_NFC_TAG_PAYLOAD",
      status: "VERIFYING",
      payloadJson: {
        tagId: "tag-1",
        studentId: "student-1",
        publicCode: "public-1",
        payload: "SCNFC:public-1",
        format: "NDEF_TEXT",
        verifyAfterWrite: true,
        captureReaderCredential: true,
      },
      targetTagId: "tag-1",
      targetStudentId: "student-1",
      expectedPayload: "SCNFC:public-1",
      writtenPayload: "SCNFC:public-1",
      readbackPayload: null,
      credentialJson: null,
      credentialStatus: "PENDING",
      credentialError: null,
      sentAt: new Date(),
      writeStartedAt: new Date(),
      writeCompletedAt: new Date(),
      verifyStartedAt: new Date(),
      verifiedAt: null,
      failedAt: null,
      credentialLinkedAt: null,
      errorMessage: null,
      requestedByUserId: "admin-1",
      requestedAt: new Date(),
      ackedAt: null,
      completedAt: null,
      lastStatusAt: new Date(),
      lastStatusMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    db.nfcTag.findFirst.mockResolvedValue({
      id: "tag-1",
      schoolId: "school-1",
      publicCode: "public-1",
      physicalUid: null,
      tagMode: "TEXT",
      label: null,
      status: "WRITTEN",
      studentId: "student-1",
      writtenUrl: "https://app/t/public-1",
      writtenPayload: "SCNFC:public-1",
      writtenAt: new Date(),
      verifiedAt: null,
      assignedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      student: {
        id: "student-1",
        admissionNumber: "ADM-001",
        firstName: "Claire",
        lastName: "Nakibuuka",
      },
    });
    db.readerDeviceCommand.update.mockImplementation(async ({ data }: { data: Record<string, any> }) => ({
      ...(await db.readerDeviceCommand.findFirst()),
      ...data,
      id: "command-1",
      schoolId: "school-1",
      deviceId: "device-1",
      type: "WRITE_NFC_TAG_PAYLOAD",
      payloadJson: {
        tagId: "tag-1",
        studentId: "student-1",
        publicCode: "public-1",
        payload: "SCNFC:public-1",
        format: "NDEF_TEXT",
        verifyAfterWrite: true,
        captureReaderCredential: true,
      },
      targetTagId: "tag-1",
      targetStudentId: "student-1",
      expectedPayload: "SCNFC:public-1",
      requestedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = await processReaderTagWriteCommandCallback({
      id: "device-1",
      schoolId: "school-1",
      deviceKey: "gate-reader-1",
      name: "Gate Reader",
    }, {
      commandId: "command-1",
      deviceId: "device-1",
      status: "VERIFIED",
      readbackPayload: "SCNFC:wrong-public-code",
    }, db as never);

    expect(result.status).toBe("FAILED");
    expect(result.mobilePayloadStatus).toBe("failed");
    expect(linkReaderCredentialToAssignedTagMock).not.toHaveBeenCalled();
  });

  it("preserves failure state and never marks the tag written or verified when the controller reports FAILED", async () => {
    const db = buildDb();
    db.readerDeviceCommand.findFirst.mockResolvedValue({
      id: "command-1",
      schoolId: "school-1",
      deviceId: "device-1",
      type: "WRITE_NFC_TAG_PAYLOAD",
      status: "WRITING",
      payloadJson: {
        tagId: "tag-1",
        studentId: "student-1",
        publicCode: "public-1",
        payload: "SCNFC:public-1",
        format: "NDEF_TEXT",
        verifyAfterWrite: true,
        captureReaderCredential: true,
      },
      targetTagId: "tag-1",
      targetStudentId: "student-1",
      expectedPayload: "SCNFC:public-1",
      writtenPayload: null,
      readbackPayload: null,
      credentialJson: null,
      credentialStatus: "PENDING",
      credentialError: null,
      sentAt: new Date(),
      writeStartedAt: new Date(),
      writeCompletedAt: null,
      verifyStartedAt: null,
      verifiedAt: null,
      failedAt: null,
      credentialLinkedAt: null,
      errorMessage: null,
      requestedByUserId: "admin-1",
      requestedAt: new Date(),
      ackedAt: null,
      completedAt: null,
      lastStatusAt: new Date(),
      lastStatusMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    db.nfcTag.findFirst.mockResolvedValue({
      id: "tag-1",
      schoolId: "school-1",
      publicCode: "public-1",
      physicalUid: null,
      tagMode: "TEXT",
      label: null,
      status: "ASSIGNED",
      studentId: "student-1",
      writtenUrl: "https://app/t/public-1",
      writtenPayload: "SCNFC:public-1",
      writtenAt: null,
      verifiedAt: null,
      assignedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      student: {
        id: "student-1",
        admissionNumber: "ADM-001",
        firstName: "Claire",
        lastName: "Nakibuuka",
      },
    });
    db.readerDeviceCommand.update.mockImplementation(async ({ data }: { data: Record<string, any> }) => ({
      ...(await db.readerDeviceCommand.findFirst()),
      ...data,
      id: "command-1",
      schoolId: "school-1",
      deviceId: "device-1",
      type: "WRITE_NFC_TAG_PAYLOAD",
      payloadJson: {
        tagId: "tag-1",
        studentId: "student-1",
        publicCode: "public-1",
        payload: "SCNFC:public-1",
        format: "NDEF_TEXT",
        verifyAfterWrite: true,
        captureReaderCredential: true,
      },
      targetTagId: "tag-1",
      targetStudentId: "student-1",
      expectedPayload: "SCNFC:public-1",
      requestedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = await processReaderTagWriteCommandCallback({
      id: "device-1",
      schoolId: "school-1",
      deviceKey: "gate-reader-1",
      name: "Gate Reader",
    }, {
      commandId: "command-1",
      deviceId: "device-1",
      status: "FAILED",
      errorMessage: "NDEF write failed",
    }, db as never);

    expect(result.status).toBe("FAILED");
    expect(db.nfcTag.update).not.toHaveBeenCalled();
    expect(linkReaderCredentialToAssignedTagMock).not.toHaveBeenCalled();
  });
});
