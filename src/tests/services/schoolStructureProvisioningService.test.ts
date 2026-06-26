import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applySchoolStructureRepair,
  previewSchoolStructureRepair,
  provisionCanonicalSchoolStructure,
} from "../../server/services/schoolStructureProvisioningService";

function createStructureDb() {
  const state = {
    classes: [] as Array<{ id: string; schoolId: string; name: string; code: string; level: number }>,
    streams: [] as Array<{ id: string; schoolId: string; classId: string; name: string; code: string }>,
    subjects: [] as Array<{ id: string; schoolId: string; name: string; code: string; sortOrder: number; isActive: boolean }>,
    appSetting: null as null | { schoolCode: string; sections: unknown },
  };
  let nextId = 1;
  const makeId = (prefix: string) => `${prefix}-${nextId++}`;

  return {
    state,
    school: {
      findUnique: vi.fn(async ({ where }: any) => (
        where.code === "SCU-PREVIEW"
          ? { id: "school-1", code: "SCU-PREVIEW", name: "Preview School" }
          : null
      )),
    },
    appSetting: {
      findUnique: vi.fn(async () => state.appSetting),
    },
    schoolClass: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const existing = state.classes.find(
          (klass) => klass.schoolId === where.schoolId_code.schoolId && klass.code === where.schoolId_code.code,
        );
        if (existing) {
          existing.name = update.name ?? existing.name;
          existing.level = update.level ?? existing.level;
          return existing;
        }
        const created = { id: makeId("class"), ...create };
        state.classes.push(created);
        return created;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        let rows = [...state.classes];
        if (where?.schoolId) rows = rows.filter((klass) => klass.schoolId === where.schoolId);
        if (where?.code?.in) {
          const codeSet = new Set(where.code.in);
          rows = rows.filter((klass) => codeSet.has(klass.code));
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
        const created = { id: makeId("stream"), ...data };
        state.streams.push(created);
        return created;
      }),
    },
    subject: {
      findFirst: vi.fn(async ({ where }: any) => state.subjects.find((subject) => (
        subject.schoolId === where.schoolId
        && (where.OR?.some((candidate: any) => candidate.code === subject.code || candidate.name === subject.name) ?? false)
      )) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const created = { id: makeId("subject"), ...data };
        state.subjects.push(created);
        return created;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const existing = state.subjects.find((subject) => subject.id === where.id)!;
        Object.assign(existing, data);
        return existing;
      }),
      findMany: vi.fn(async ({ where }: any) => state.subjects.filter((subject) => subject.schoolId === where.schoolId)),
    },
  };
}

describe("schoolStructureProvisioningService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("provisions nursery-only canonical classes and default stream A", async () => {
    const db = createStructureDb();

    const result = await provisionCanonicalSchoolStructure(db as any, "school-1", {
      sections: ["NURSERY"],
    });

    expect(result.classCount).toBe(3);
    expect(result.sectionClassCodes).toEqual(["NUR_BABY", "NUR_MIDDLE", "NUR_TOP"]);
    expect(db.state.streams).toHaveLength(3);
    expect(db.state.streams.every((stream) => stream.code === "A")).toBe(true);
  });

  it("provisions primary-only canonical classes", async () => {
    const db = createStructureDb();

    const result = await provisionCanonicalSchoolStructure(db as any, "school-1", {
      sections: ["PRIMARY"],
    });

    expect(result.classCount).toBe(7);
    expect(result.sectionClassCodes).toEqual(["P1", "P2", "P3", "P4", "P5", "P6", "P7"]);
  });

  it("provisions secondary-only canonical classes", async () => {
    const db = createStructureDb();

    const result = await provisionCanonicalSchoolStructure(db as any, "school-1", {
      sections: ["SECONDARY"],
    });

    expect(result.classCount).toBe(6);
    expect(result.sectionClassCodes).toEqual(["S1", "S2", "S3", "S4", "S5", "S6"]);
  });

  it("treats COMBINED as primary plus secondary and supports multiple streams", async () => {
    const db = createStructureDb();

    const result = await provisionCanonicalSchoolStructure(db as any, "school-1", {
      sections: ["COMBINED"],
      defaultStreamCodes: ["A", "B"],
    });

    expect(result.classCount).toBe(13);
    expect(db.state.streams).toHaveLength(26);
    expect(db.state.streams.filter((stream) => stream.code === "A")).toHaveLength(13);
    expect(db.state.streams.filter((stream) => stream.code === "B")).toHaveLength(13);
  });

  it("does not create duplicate streams when a class already has stream A", async () => {
    const db = createStructureDb();
    db.state.classes.push({ id: "class-s1", schoolId: "school-1", name: "Senior 1", code: "S1", level: 20 });
    db.state.streams.push({ id: "stream-a", schoolId: "school-1", classId: "class-s1", name: "A", code: "A" });

    const result = await provisionCanonicalSchoolStructure(db as any, "school-1", {
      sections: ["SECONDARY"],
      defaultStreamCodes: ["A", "B"],
    });

    expect(result.classCount).toBe(6);
    expect(db.state.streams.filter((stream) => stream.classId === "class-s1")).toHaveLength(2);
    expect(db.state.streams.filter((stream) => stream.classId === "class-s1" && stream.code === "A")).toHaveLength(1);
  });

  it("previews and applies safe missing class, stream, and subject repairs", async () => {
    const db = createStructureDb();
    db.state.appSetting = {
      schoolCode: "SCU-PREVIEW",
      sections: { school: { schoolSections: ["PRIMARY"] } },
    };
    db.state.classes.push({ id: "class-p1", schoolId: "school-1", name: "Primary 1", code: "P1", level: 10 });

    const preview = await previewSchoolStructureRepair(db as any, "SCU-PREVIEW", {
      sections: ["PRIMARY"],
      defaultStreamCodes: ["A"],
    });

    expect(preview.missingClasses).toContain("P2");
    expect(preview.missingStreamsByClassCode.P1).toEqual(["A"]);
    expect(preview.applyChanges.createSubjects).toBeGreaterThan(0);

    const afterApply = await applySchoolStructureRepair(db as any, "SCU-PREVIEW", {
      sections: ["PRIMARY"],
      defaultStreamCodes: ["A"],
    });

    expect(afterApply.applyChanges).toEqual({
      createClasses: 0,
      createStreams: 0,
      createSubjects: 0,
    });
    expect(db.state.classes).toHaveLength(7);
    expect(db.state.streams).toHaveLength(7);
  });
});
