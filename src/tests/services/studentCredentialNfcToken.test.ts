import { CredentialStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { resolveNfcCredentialToken } from "../../server/services/nfcCredentialTokenService";
import type { AuthPayload } from "../../server/services/authService";

type Role = "ADMIN_OPERATOR" | "SECURITY" | "GATE_SECURITY" | "CANTEEN" | "CASHIER" | "TEACHER";

type CredentialRow = {
  id: string;
  schoolId: string;
  scanToken: string | null;
  credentialUID: string;
  status: CredentialStatus;
  school: {
    id: string;
    name: string;
    code: string;
  };
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    walletBalance?: number;
    guardianContacts?: string[];
    enrollments: Array<{
      class: { name: string } | null;
      stream: { name: string } | null;
    }>;
  };
};

function auth(role: Role, schoolId = "school-a"): AuthPayload {
  return {
    userId: `${role.toLowerCase()}-user`,
    schoolId,
    name: role,
    email: `${role.toLowerCase()}@example.test`,
    role,
  } as AuthPayload;
}

function createMockDb(overrides: Partial<CredentialRow> = {}) {
  const credential: CredentialRow = {
    id: "credential-a",
    schoolId: "school-a",
    scanToken: "neutral-token-a",
    credentialUID: "WRISTBAND-001",
    status: CredentialStatus.ACTIVE,
    school: {
      id: "school-a",
      name: "Hilltop School",
      code: "HTS",
    },
    student: {
      id: "student-a",
      admissionNumber: "A-001",
      firstName: "Ada",
      lastName: "Lovelace",
      isActive: true,
      walletBalance: 12500,
      guardianContacts: ["+256700000000"],
      enrollments: [{ class: { name: "Senior 1" }, stream: { name: "A" } }],
    },
    ...overrides,
  };

  return {
    studentCredential: {
      findUnique: async ({ where }: { where: { scanToken?: string | null } }) => (where.scanToken === credential.scanToken ? credential : null),
    },
  } as never;
}

describe("resolveNfcCredentialToken", () => {
  it("returns a safe public student ID page for unauthenticated scans", async () => {
    const result = await resolveNfcCredentialToken("neutral-token-a", null, createMockDb());

    expect(result).toMatchObject({
      found: true,
      mode: "PUBLIC_ID",
      targetPath: "/nfc/t/neutral-token-a",
      valid: true,
      actionBlocked: false,
      credential: {
        id: "credential-a",
        nfcUrl: "/nfc/t/neutral-token-a",
      },
      student: {
        id: "student-a",
        name: "Ada Lovelace",
        admissionNumber: "A-001",
        className: "Senior 1",
        streamName: "A",
        schoolName: "Hilltop School",
      },
    });
    expect(result.student).not.toHaveProperty("walletBalance");
    expect(result.student).not.toHaveProperty("guardianContacts");
    expect(result.credential).not.toHaveProperty("credentialUID");
  });

  it.each([
    ["SECURITY", "GATE_SECURITY", "/gate/nfc/neutral-token-a"],
    ["CASHIER", "CANTEEN_CHARGE", "/canteen/nfc/neutral-token-a"],
    ["TEACHER", "ATTENDANCE_SCAN", "/attendance/nfc/neutral-token-a"],
    ["ADMIN_OPERATOR", "ADMIN_CREDENTIAL", "/student-credentials?credentialId=credential-a"],
  ] as const)("resolves %s users to %s without changing the tag URL", async (role, mode, targetPath) => {
    const result = await resolveNfcCredentialToken("neutral-token-a", auth(role), createMockDb());

    expect(result.mode).toBe(mode);
    expect(result.targetPath).toBe(targetPath);
    expect(result.credential?.nfcUrl).toBe("/nfc/t/neutral-token-a");
    expect(result.credential?.nfcUrl).not.toContain("/canteen/");
    expect(result.valid).toBe(true);
    expect(result.actionBlocked).toBe(false);
  });

  it("blocks authenticated users from another school", async () => {
    await expect(resolveNfcCredentialToken("neutral-token-a", auth("ADMIN_OPERATOR", "school-b"), createMockDb())).rejects.toMatchObject({
      status: 403,
    });
  });

  it("blocks deactivated credentials in every mode", async () => {
    const result = await resolveNfcCredentialToken(
      "neutral-token-a",
      auth("CASHIER"),
      createMockDb({ status: CredentialStatus.DEACTIVATED }),
    );

    expect(result).toMatchObject({
      found: true,
      mode: "CANTEEN_CHARGE",
      valid: false,
      actionBlocked: true,
      credentialStatus: "DEACTIVATED",
    });
    expect(result.targetPath).toBeUndefined();
    expect(result.credential?.nfcUrl).toBe("/nfc/t/neutral-token-a");
  });

  it("blocks credentials for inactive students", async () => {
    const result = await resolveNfcCredentialToken(
      "neutral-token-a",
      auth("TEACHER"),
      createMockDb({
        student: {
          id: "student-a",
          admissionNumber: "A-001",
          firstName: "Ada",
          lastName: "Lovelace",
          isActive: false,
          enrollments: [{ class: { name: "Senior 1" }, stream: { name: "A" } }],
        },
      }),
    );

    expect(result).toMatchObject({
      found: true,
      mode: "ATTENDANCE_SCAN",
      valid: false,
      actionBlocked: true,
      studentStatus: "INACTIVE",
    });
  });

  it("returns a safe invalid public result when the token is unknown", async () => {
    const result = await resolveNfcCredentialToken("unknown-token", null, createMockDb());

    expect(result).toEqual({
      found: false,
      mode: "PUBLIC_ID",
      credentialStatus: "INVALID",
      valid: false,
    });
  });
});
