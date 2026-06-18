import { beforeEach, describe, expect, it, vi } from "vitest";
import supertest from "supertest";
import express from "express";
import { schoolStructureRoutes } from "../../server/routes/schoolStructureRoutes";
import { resolveSchoolContext } from "../../server/middleware/resolveSchoolContext";

const {
  schoolFindUnique,
  appSettingFindUnique,
  appSettingUpsert,
  schoolClassFindMany,
  schoolClassFindFirst,
  schoolClassUpsert,
  streamFindMany,
  streamFindUnique,
  streamFindFirst,
  streamCreate,
  streamDelete,
  enrollmentCount,
  markCount,
} = vi.hoisted(() => ({
  schoolFindUnique: vi.fn(),
  appSettingFindUnique: vi.fn(),
  appSettingUpsert: vi.fn(),
  schoolClassFindMany: vi.fn(),
  schoolClassFindFirst: vi.fn(),
  schoolClassUpsert: vi.fn(),
  streamFindMany: vi.fn(),
  streamFindUnique: vi.fn(),
  streamFindFirst: vi.fn(),
  streamCreate: vi.fn(),
  streamDelete: vi.fn(),
  enrollmentCount: vi.fn(),
  markCount: vi.fn(),
}));

vi.mock("../../server/db/prisma", () => ({
  prisma: {
    school: { findUnique: schoolFindUnique },
    appSetting: { findUnique: appSettingFindUnique, upsert: appSettingUpsert },
    schoolClass: {
      findMany: schoolClassFindMany,
      findFirst: schoolClassFindFirst,
      upsert: schoolClassUpsert,
    },
    stream: {
      findMany: streamFindMany,
      findUnique: streamFindUnique,
      findFirst: streamFindFirst,
      create: streamCreate,
      delete: streamDelete,
    },
    classEnrollment: { count: enrollmentCount },
    subjectMark: { count: markCount },
  },
}));

const MOCK_SCHOOL = { id: "school-1", code: "SCU-PREVIEW", name: "Preview School" };
const MOCK_SECONDARY_CLASSES = [
  { id: "cs1", name: "Senior 1", code: "S1", level: 20 },
  { id: "cs2", name: "Senior 2", code: "S2", level: 21 },
  { id: "cs3", name: "Senior 3", code: "S3", level: 22 },
  { id: "cs4", name: "Senior 4", code: "S4", level: 23 },
  { id: "cs5", name: "Senior 5", code: "S5", level: 24 },
  { id: "cs6", name: "Senior 6", code: "S6", level: 25 },
];
const MOCK_STREAMS = [
  { id: "stream-a", classId: "cs1", schoolId: "school-1", name: "A", code: "A" },
  { id: "stream-b", classId: "cs1", schoolId: "school-1", name: "B", code: "B" },
];

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(resolveSchoolContext);
  app.use(schoolStructureRoutes());
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  schoolFindUnique.mockResolvedValue(MOCK_SCHOOL);
  appSettingFindUnique.mockResolvedValue(null);
  appSettingUpsert.mockResolvedValue({
    schoolCode: "SCU-PREVIEW",
    sections: null,
    updatedAt: new Date("2026-01-01"),
    updatedBy: null,
  });
  schoolClassFindMany.mockResolvedValue(MOCK_SECONDARY_CLASSES);
  schoolClassFindFirst.mockResolvedValue(MOCK_SECONDARY_CLASSES[0]);
  schoolClassUpsert.mockResolvedValue({});
  streamFindMany.mockResolvedValue(MOCK_STREAMS);
  streamFindUnique.mockResolvedValue(null);
  streamFindFirst.mockResolvedValue(MOCK_STREAMS[0]);
  streamCreate.mockResolvedValue({ id: "stream-c", schoolId: "school-1", classId: "cs1", name: "C", code: "C" });
  streamDelete.mockResolvedValue({});
  enrollmentCount.mockResolvedValue(0);
  markCount.mockResolvedValue(0);
});

describe("GET /api/settings/school-structure", () => {
  it("returns 200 with school structure JSON", async () => {
    const res = await supertest(createApp()).get(
      "/api/settings/school-structure?schoolCode=SCU-PREVIEW",
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.school.code).toBe("SCU-PREVIEW");
    expect(Array.isArray(res.body.selectedSections)).toBe(true);
    expect(Array.isArray(res.body.canonicalClasses)).toBe(true);
    expect(res.body.availableSections).toHaveLength(3);
  });

  it("returns 404 when school not found", async () => {
    schoolFindUnique.mockResolvedValue(null);
    const res = await supertest(createApp()).get(
      "/api/settings/school-structure?schoolCode=UNKNOWN",
    );
    expect(res.status).toBe(404);
  });

  it("groups streams under their canonical class", async () => {
    const res = await supertest(createApp()).get(
      "/api/settings/school-structure?schoolCode=SCU-PREVIEW",
    );
    const s1 = (res.body.canonicalClasses as Array<{ code: string; streams: unknown[] }>).find(
      (c) => c.code === "S1",
    );
    expect(s1).toBeDefined();
    expect(s1!.streams).toHaveLength(2);
  });
});

describe("PATCH /api/settings/school-structure", () => {
  it("returns 200 and provisions 6 secondary classes", async () => {
    const res = await supertest(createApp())
      .patch("/api/settings/school-structure")
      .send({ schoolCode: "SCU-PREVIEW", selectedSections: ["SECONDARY"] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(schoolClassUpsert).toHaveBeenCalledTimes(6);
  });

  it("provisions 13 classes (7 primary + 6 secondary) for PRIMARY + SECONDARY", async () => {
    const res = await supertest(createApp())
      .patch("/api/settings/school-structure")
      .send({ schoolCode: "SCU-PREVIEW", selectedSections: ["PRIMARY", "SECONDARY"] });

    expect(res.status).toBe(200);
    expect(schoolClassUpsert).toHaveBeenCalledTimes(13);
  });

  it("returns 409 when removing a section that has enrolled students", async () => {
    // Current settings default to ["SECONDARY"]; removing SECONDARY when it has enrolments
    enrollmentCount.mockResolvedValue(8);
    schoolClassFindMany.mockResolvedValue(MOCK_SECONDARY_CLASSES);

    const res = await supertest(createApp())
      .patch("/api/settings/school-structure")
      .send({ schoolCode: "SCU-PREVIEW", selectedSections: ["PRIMARY"] });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("SECTION_HAS_DATA");
  });

  it("returns 400 when selectedSections is missing", async () => {
    const res = await supertest(createApp())
      .patch("/api/settings/school-structure")
      .send({ schoolCode: "SCU-PREVIEW" });

    expect(res.status).toBe(400);
  });

  it("returns 404 when school not found", async () => {
    schoolFindUnique.mockResolvedValue(null);
    const res = await supertest(createApp())
      .patch("/api/settings/school-structure")
      .send({ schoolCode: "BAD", selectedSections: ["SECONDARY"] });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/settings/school-structure/streams", () => {
  it("creates a stream and returns 201", async () => {
    const res = await supertest(createApp())
      .post("/api/settings/school-structure/streams")
      .send({ schoolCode: "SCU-PREVIEW", classId: "cs1", name: "C", code: "C" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(streamCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: "C", name: "C", classId: "cs1" }),
    });
  });

  it("returns 409 when stream code already exists in the class", async () => {
    streamFindUnique.mockResolvedValue({ id: "existing", classId: "cs1", code: "A" });
    const res = await supertest(createApp())
      .post("/api/settings/school-structure/streams")
      .send({ schoolCode: "SCU-PREVIEW", classId: "cs1", name: "A", code: "A" });

    expect(res.status).toBe(409);
    expect(streamCreate).not.toHaveBeenCalled();
  });

  it("returns 404 when class not found", async () => {
    schoolClassFindFirst.mockResolvedValue(null);
    const res = await supertest(createApp())
      .post("/api/settings/school-structure/streams")
      .send({ schoolCode: "SCU-PREVIEW", classId: "bad-id", name: "A", code: "A" });

    expect(res.status).toBe(404);
  });

  it("returns 400 when classId is missing", async () => {
    const res = await supertest(createApp())
      .post("/api/settings/school-structure/streams")
      .send({ schoolCode: "SCU-PREVIEW", name: "A", code: "A" });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/settings/school-structure/streams/:streamId", () => {
  it("deletes the stream and returns 200 when no data exists", async () => {
    const res = await supertest(createApp()).delete(
      "/api/settings/school-structure/streams/stream-a?schoolCode=SCU-PREVIEW",
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(streamDelete).toHaveBeenCalledWith({ where: { id: "stream-a" } });
  });

  it("returns 409 when the stream has enrolled students", async () => {
    enrollmentCount.mockResolvedValue(3);
    const res = await supertest(createApp()).delete(
      "/api/settings/school-structure/streams/stream-a?schoolCode=SCU-PREVIEW",
    );

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("STREAM_HAS_DATA");
    expect(streamDelete).not.toHaveBeenCalled();
  });

  it("returns 409 when the stream has marks", async () => {
    markCount.mockResolvedValue(50);
    const res = await supertest(createApp()).delete(
      "/api/settings/school-structure/streams/stream-a?schoolCode=SCU-PREVIEW",
    );

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("STREAM_HAS_DATA");
  });

  it("returns 404 when stream not found", async () => {
    streamFindFirst.mockResolvedValue(null);
    const res = await supertest(createApp()).delete(
      "/api/settings/school-structure/streams/no-such-stream?schoolCode=SCU-PREVIEW",
    );

    expect(res.status).toBe(404);
  });
});

