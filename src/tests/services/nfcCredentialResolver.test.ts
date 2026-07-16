import { CredentialStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { resolveNfcCredential } from "../../server/services/nfcCredentialResolver";

function createDb() {
  const credentials = [
    {
      id: "cred-w26-fc-card",
      schoolId: "school-a",
      studentId: "student-1",
      credentialUID: "12-1",
      scanToken: null,
      status: CredentialStatus.ACTIVE,
      student: {
        id: "student-1",
        schoolId: "school-a",
        firstName: "Ada",
        lastName: "Lovelace",
        admissionNumber: "A001",
        isActive: true,
        studentType: "DAY" as const,
        attendanceProfile: "DAY_SCHOLAR",
        enrollments: [{ classId: "class-a", streamId: "stream-a" }],
      },
    },
    {
      id: "cred-w26-decimal",
      schoolId: "school-a",
      studentId: "student-2",
      credentialUID: "35128677",
      scanToken: null,
      status: CredentialStatus.ACTIVE,
      student: {
        id: "student-2",
        schoolId: "school-a",
        firstName: "Grace",
        lastName: "Hopper",
        admissionNumber: "A002",
        isActive: true,
        studentType: "DAY" as const,
        attendanceProfile: "DAY_SCHOLAR",
        enrollments: [],
      },
    },
    {
      id: "cred-w26-hex",
      schoolId: "school-a",
      studentId: "student-6",
      credentialUID: "02180565",
      scanToken: null,
      status: CredentialStatus.ACTIVE,
      student: {
        id: "student-6",
        schoolId: "school-a",
        firstName: "Annie",
        lastName: "Easley",
        admissionNumber: "A006",
        isActive: true,
        studentType: "DAY" as const,
        attendanceProfile: "DAY_SCHOLAR",
        enrollments: [],
      },
    },
    {
      id: "cred-w34-decimal",
      schoolId: "school-a",
      studentId: "student-3",
      credentialUID: "9830412345",
      scanToken: null,
      status: CredentialStatus.ACTIVE,
      student: {
        id: "student-3",
        schoolId: "school-a",
        firstName: "Katherine",
        lastName: "Johnson",
        admissionNumber: "A003",
        isActive: true,
        studentType: "DAY" as const,
        attendanceProfile: "DAY_SCHOLAR",
        enrollments: [],
      },
    },
    {
      id: "cred-w34-hex",
      schoolId: "school-a",
      studentId: "student-7",
      credentialUID: "024001431",
      scanToken: null,
      status: CredentialStatus.ACTIVE,
      student: {
        id: "student-7",
        schoolId: "school-a",
        firstName: "Margaret",
        lastName: "Hamilton",
        admissionNumber: "A007",
        isActive: true,
        studentType: "DAY" as const,
        attendanceProfile: "DAY_SCHOLAR",
        enrollments: [],
      },
    },
    {
      id: "cred-wrong-school",
      schoolId: "school-b",
      studentId: "student-9",
      credentialUID: "WRONG-SCHOOL",
      scanToken: null,
      status: CredentialStatus.ACTIVE,
      student: {
        id: "student-9",
        schoolId: "school-b",
        firstName: "Other",
        lastName: "School",
        admissionNumber: "B001",
        isActive: true,
        studentType: "DAY" as const,
        attendanceProfile: "DAY_SCHOLAR",
        enrollments: [],
      },
    },
  ];

  const tags = [
    {
      id: "tag-public",
      schoolId: "school-a",
      studentId: "student-4",
      publicCode: "PUB001",
      physicalUid: null,
      status: "ASSIGNED",
      student: {
        id: "student-4",
        schoolId: "school-a",
        firstName: "Dorothy",
        lastName: "Vaughan",
        admissionNumber: "A004",
        isActive: true,
        studentType: "DAY" as const,
        attendanceProfile: "DAY_SCHOLAR",
        enrollments: [],
      },
    },
    {
      id: "tag-uid",
      schoolId: "school-a",
      studentId: "student-5",
      publicCode: "PUB002",
      physicalUid: "TAGPHYS001",
      status: "ASSIGNED",
      student: {
        id: "student-5",
        schoolId: "school-a",
        firstName: "Mary",
        lastName: "Jackson",
        admissionNumber: "A005",
        isActive: true,
        studentType: "DAY" as const,
        attendanceProfile: "DAY_SCHOLAR",
        enrollments: [],
      },
    },
    {
      id: "tag-orphan",
      schoolId: "school-a",
      studentId: null,
      publicCode: "ORPHAN-1",
      physicalUid: "ORPHAN-UID",
      status: "REGISTERED",
      student: null,
    },
  ];

  return {
    studentCredential: {
      findFirst: vi.fn(async ({ where }: { where: { schoolId?: string; type?: string; OR?: Array<{ scanToken?: string; credentialUID?: string }> } }) => {
        return credentials.find((credential) => {
          if (where.schoolId && credential.schoolId !== where.schoolId) return false;
          if (!where.OR?.length) return false;
          return where.OR.some((entry) =>
            (entry.scanToken !== undefined && entry.scanToken === credential.scanToken)
            || (entry.credentialUID !== undefined && entry.credentialUID === credential.credentialUID));
        }) ?? null;
      }),
    },
    nfcTag: {
      findFirst: vi.fn(async ({ where }: { where: { schoolId?: string; OR?: Array<{ publicCode?: string; physicalUid?: { equals: string; mode: string } }> } }) => {
        return tags.find((tag) => {
          if (where.schoolId && tag.schoolId !== where.schoolId) return false;
          if (!where.OR?.length) return false;
          return where.OR.some((entry) =>
            (entry.publicCode !== undefined && entry.publicCode === tag.publicCode)
            || (entry.physicalUid?.equals
              ? tag.physicalUid?.toLowerCase() === entry.physicalUid.equals.toLowerCase()
              : false));
        }) ?? null;
      }),
    },
  } as const;
}

describe("resolveNfcCredential", () => {
  it("resolves W26 facility/card candidates", async () => {
    const db = createDb();
    const result = await resolveNfcCredential(db as never, {
      schoolId: "school-a",
      rawWiegandBitCount: 26,
      facilityCode: "12",
      cardNumber: "1",
      rawWiegandDecimal: "35128677",
      rawWiegandHex: "02180565",
      value: "786777",
    });

    expect(result).toMatchObject({
      ok: true,
      source: "studentCredential.credentialUID",
      student: { id: "student-1" },
    });
  });

  it("resolves W34 facility/card candidates", async () => {
    const db = createDb();
    const result = await resolveNfcCredential(db as never, {
      schoolId: "school-a",
      rawWiegandBitCount: 34,
      facilityCode: "77",
      cardNumber: "321",
      rawWiegandDecimal: "9830412345",
      rawWiegandHex: "024001431",
      value: "wrong-school",
    });

    expect(result).toMatchObject({
      ok: true,
      source: "studentCredential.credentialUID",
      student: { id: "student-3" },
    });
  });

  it("resolves W26 raw decimal candidates", async () => {
    const db = createDb();
    const result = await resolveNfcCredential(db as never, {
      schoolId: "school-a",
      rawWiegandBitCount: 26,
      rawWiegandDecimal: "35128677",
      value: "35128677",
    });

    expect(result).toMatchObject({ ok: true, student: { id: "student-2" } });
  });

  it("resolves W34 raw decimal candidates", async () => {
    const db = createDb();
    const result = await resolveNfcCredential(db as never, {
      schoolId: "school-a",
      rawWiegandBitCount: 34,
      rawWiegandDecimal: "9830412345",
      value: "9830412345",
    });

    expect(result).toMatchObject({ ok: true, student: { id: "student-3" } });
  });

  it("resolves W26 raw hex candidates", async () => {
    const db = createDb();
    const result = await resolveNfcCredential(db as never, {
      schoolId: "school-a",
      rawWiegandBitCount: 26,
      rawWiegandHex: "02180565",
      value: "02180565",
    });

    expect(result).toMatchObject({
      ok: true,
      source: "studentCredential.credentialUID",
      student: { id: "student-6" },
    });
  });

  it("resolves W34 raw hex candidates", async () => {
    const db = createDb();
    const result = await resolveNfcCredential(db as never, {
      schoolId: "school-a",
      rawWiegandBitCount: 34,
      rawWiegandHex: "024001431",
      value: "024001431",
    });

    expect(result).toMatchObject({ ok: true, student: { id: "student-7" } });
  });

  it("resolves lowercase hex and 0x-prefixed hex candidates", async () => {
    const db = createDb();
    const lower = await resolveNfcCredential(db as never, {
      schoolId: "school-a",
      rawWiegandBitCount: 26,
      rawWiegandHex: "02180565",
      value: "0x02180565",
    });
    const mixed = await resolveNfcCredential(db as never, {
      schoolId: "school-a",
      rawWiegandBitCount: 26,
      rawWiegandHex: "02180565",
      value: "02180565".toLowerCase(),
    });

    expect(lower).toMatchObject({ ok: true, student: { id: "student-6" } });
    expect(mixed).toMatchObject({ ok: true, student: { id: "student-6" } });
  });

  it("resolves tags stored by publicCode", async () => {
    const db = createDb();
    const result = await resolveNfcCredential(db as never, {
      schoolId: "school-a",
      value: "SCNFC:PUB001",
    });

    expect(result).toMatchObject({
      ok: true,
      source: "nfcTag.publicCode",
      student: { id: "student-4" },
    });
  });

  it("resolves tags stored by physicalUid", async () => {
    const db = createDb();
    const result = await resolveNfcCredential(db as never, {
      schoolId: "school-a",
      value: "TAGPHYS001",
    });

    expect(result).toMatchObject({
      ok: true,
      source: "nfcTag.physicalUid",
      student: { id: "student-5" },
    });
  });

  it("returns SCHOOL_MISMATCH for a wrong-school match", async () => {
    const db = createDb();
    const result = await resolveNfcCredential(db as never, {
      schoolId: "school-a",
      rawWiegandBitCount: 34,
      value: "WRONG-SCHOOL",
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "SCHOOL_MISMATCH",
    });
  });

  it("returns TAG_ORPHANED_NOT_LINKED_TO_STUDENT for orphaned tags", async () => {
    const db = createDb();
    const result = await resolveNfcCredential(db as never, {
      schoolId: "school-a",
      value: "ORPHAN-UID",
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "TAG_ORPHANED_NOT_LINKED_TO_STUDENT",
    });
  });

  it("returns UNSUPPORTED_WIEGAND_BIT_COUNT for unsupported bit counts", async () => {
    const db = createDb();
    const result = await resolveNfcCredential(db as never, {
      schoolId: "school-a",
      rawWiegandBitCount: 37,
      value: "123",
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "UNSUPPORTED_WIEGAND_BIT_COUNT",
    });
  });
});
