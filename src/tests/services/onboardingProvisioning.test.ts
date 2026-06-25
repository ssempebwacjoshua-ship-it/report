import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../server/services/authService", () => ({
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
}));

import { provisionSchoolOnboarding } from "../../server/services/schoolStructureProvisioningService";

function createOnboardingDb() {
  const state = {
    schools: [] as any[],
    academicYears: [] as any[],
    terms: [] as any[],
    appSettings: [] as any[],
    classes: [] as any[],
    streams: [] as any[],
    subjects: [] as any[],
    subscriptions: [] as any[],
    invoices: [] as any[],
    users: [] as any[],
    audits: [] as any[],
  };
  let nextId = 1;
  const makeId = (prefix: string) => `${prefix}-${nextId++}`;

  return {
    state,
    school: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: makeId("school"), createdAt: new Date(), updatedAt: new Date(), ...data };
        state.schools.push(row);
        return row;
      }),
    },
    academicYear: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: makeId("year"), ...data };
        state.academicYears.push(row);
        return row;
      }),
    },
    term: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: makeId("term"), ...data };
        state.terms.push(row);
        return row;
      }),
    },
    appSetting: {
      create: vi.fn(async ({ data }: any) => {
        state.appSettings.push(data);
        return data;
      }),
    },
    schoolClass: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const existing = state.classes.find((klass) => klass.schoolId === where.schoolId_code.schoolId && klass.code === where.schoolId_code.code);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { id: makeId("class"), ...create };
        state.classes.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        let rows = [...state.classes];
        if (where?.schoolId) rows = rows.filter((klass) => klass.schoolId === where.schoolId);
        if (where?.code?.in) {
          const codes = new Set(where.code.in);
          rows = rows.filter((klass) => codes.has(klass.code));
        }
        return rows.sort((a, b) => a.level - b.level);
      }),
    },
    stream: {
      findMany: vi.fn(async ({ where }: any) => {
        let rows = [...state.streams];
        if (where?.schoolId) rows = rows.filter((stream) => stream.schoolId === where.schoolId);
        if (where?.classId?.in) {
          const classIds = new Set(where.classId.in);
          rows = rows.filter((stream) => classIds.has(stream.classId));
        }
        return rows;
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: makeId("stream"), ...data };
        state.streams.push(row);
        return row;
      }),
    },
    subject: {
      findFirst: vi.fn(async ({ where }: any) => state.subjects.find((subject) => (
        subject.schoolId === where.schoolId
        && (where.OR?.some((candidate: any) => candidate.code === subject.code || candidate.name === subject.name) ?? false)
      )) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: makeId("subject"), ...data };
        state.subjects.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.subjects.find((subject) => subject.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
    reportLabSubscription: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: makeId("sub"), ...data };
        state.subscriptions.push(row);
        return row;
      }),
    },
    reportLabInvoice: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: makeId("invoice"), ...data };
        state.invoices.push(row);
        return row;
      }),
    },
    user: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: makeId("user"), tokenVersion: 0, ...data };
        state.users.push(row);
        return row;
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: makeId("audit"), ...data };
        state.audits.push(row);
        return row;
      }),
    },
  };
}

const PLAN = { studentLimit: 500, setupFeeUgx: 500_000, annualLicenseUgx: 300_000 };

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    schoolName: "Provisioned School",
    schoolCode: "SCH-NEW",
    sections: ["PRIMARY"] as Array<"PRIMARY">,
    defaultStreamCodes: ["A"] as Array<"A">,
    planCode: "REPORT_LAB_500",
    trialDays: 30,
    adminName: "Owner Admin",
    adminEmail: "owner-admin@test.com",
    adminTemporaryPassword: "TempPass10!",
    ...overrides,
  };
}

describe("onboardingProvisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("provisions a nursery-only school", async () => {
    const db = createOnboardingDb();
    const result = await provisionSchoolOnboarding(db as any, baseInput({
      schoolCode: "NUR-1",
      sections: ["NURSERY"],
      adminEmail: "nursery@test.com",
    }), "owner-1", PLAN, new Date("2026-06-25T00:00:00Z"));

    expect(result.structure.classCount).toBe(3);
    expect(db.state.streams).toHaveLength(3);
  });

  it("provisions a primary-only school", async () => {
    const db = createOnboardingDb();
    const result = await provisionSchoolOnboarding(db as any, baseInput({
      schoolCode: "PRI-1",
      sections: ["PRIMARY"],
      adminEmail: "primary@test.com",
    }), "owner-1", PLAN, new Date("2026-06-25T00:00:00Z"));

    expect(result.structure.classCount).toBe(7);
    expect(db.state.streams).toHaveLength(7);
  });

  it("provisions a secondary-only school", async () => {
    const db = createOnboardingDb();
    const result = await provisionSchoolOnboarding(db as any, baseInput({
      schoolCode: "SEC-1",
      sections: ["SECONDARY"],
      adminEmail: "secondary@test.com",
    }), "owner-1", PLAN, new Date("2026-06-25T00:00:00Z"));

    expect(result.structure.classCount).toBe(6);
    expect(db.state.streams).toHaveLength(6);
  });

  it("provisions a combined school with multiple streams and audit trail", async () => {
    const db = createOnboardingDb();
    const result = await provisionSchoolOnboarding(db as any, baseInput({
      schoolCode: "COMBO-1",
      sections: ["COMBINED"],
      defaultStreamCodes: ["A", "B"],
      adminEmail: "combined@test.com",
    }), "owner-1", PLAN, new Date("2026-06-25T00:00:00Z"));

    expect(result.structure.classCount).toBe(13);
    expect(result.structure.streamCount).toBe(26);
    expect(result.admin.mustChangePassword).toBe(true);
    expect(result.admin.tokenVersion).toBe(0);
    expect(result.academicYear.name).toBe("2026/2027");
    expect(result.activeTerm.name).toBe("Term 1");
    expect(db.state.audits).toHaveLength(1);
    expect(db.state.audits[0].action).toBe("OWNER_CREATE_SCHOOL");
  });

  it("rejects weak temporary passwords", async () => {
    const db = createOnboardingDb();

    await expect(provisionSchoolOnboarding(db as any, baseInput({
      adminTemporaryPassword: "weakpass",
    }), "owner-1", PLAN)).rejects.toMatchObject({
      message: "Temporary password must be at least 10 characters.",
      status: 400,
    });
  });
});
