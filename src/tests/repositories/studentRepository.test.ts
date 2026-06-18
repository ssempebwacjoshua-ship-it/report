import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { listEnrolledStudents } from "../../server/repositories/studentRepository";

const SCHOOL_CODE = "SCU-TEST";
const SCHOOL_ID = "school-1";
const YEAR_ID = "year-1";
const TERM_ID = "term-1";

function makeEnrollmentRow(overrides: { classId?: string; streamId?: string } = {}) {
  return {
    id: "enrollment-1",
    studentId: "student-1",
    schoolId: SCHOOL_ID,
    academicYearId: YEAR_ID,
    termId: TERM_ID,
    classId: overrides.classId ?? "class-orphaned",
    streamId: overrides.streamId ?? "stream-orphaned",
    isActive: true,
    status: "ACTIVE",
    student: {
      id: "student-1",
      admissionNumber: "S001",
      firstName: "Alice",
      lastName: "Smith",
      isActive: true,
      guardianContacts: [
        {
          id: "contact-1",
          guardianName: "Bob Smith",
          relationship: "Parent",
          phone: "+256700000001",
          email: "bob@example.test",
          preferredContactMethod: "PHONE",
          isPrimary: true,
          canReceiveReports: true,
          notes: null,
        },
      ],
    },
  };
}

type FakeClassRecord = { id: string; name: string };
type FakeStreamRecord = { id: string; name: string; code: string };

function makeFakeDb(options: {
  enrollmentRow: ReturnType<typeof makeEnrollmentRow>;
  classes?: FakeClassRecord[];
  streams?: FakeStreamRecord[];
}) {
  const classes = options.classes ?? [];
  const streams = options.streams ?? [];

  return {
    school: {
      findUnique: async () => ({
        id: SCHOOL_ID,
        code: SCHOOL_CODE,
        name: "Test School",
        academicYears: [
          {
            id: YEAR_ID,
            isActive: true,
            terms: [{ id: TERM_ID, isActive: true }],
          },
        ],
      }),
    },
    classEnrollment: {
      findMany: async () => [options.enrollmentRow],
    },
    schoolClass: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        classes.filter((c) => where.id.in.includes(c.id)),
    },
    stream: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        streams.filter((s) => where.id.in.includes(s.id)),
    },
  } as unknown as PrismaClient;
}

describe("listEnrolledStudents â€” null class/stream fallbacks", () => {
  it("returns 'Unknown class' when classId has no matching SchoolClass record", async () => {
    const db = makeFakeDb({
      enrollmentRow: makeEnrollmentRow({ classId: "class-orphaned", streamId: "stream-1" }),
      classes: [],
      streams: [{ id: "stream-1", name: "Stream A", code: "A" }],
    });
    const result = await listEnrolledStudents(db, SCHOOL_CODE);
    expect(result).toHaveLength(1);
    expect(result[0].className).toBe("Unknown class");
    expect(result[0].streamName).toBe("Stream A");
  });

  it("returns 'Unknown stream' when streamId has no matching Stream record", async () => {
    const db = makeFakeDb({
      enrollmentRow: makeEnrollmentRow({ classId: "class-1", streamId: "stream-orphaned" }),
      classes: [{ id: "class-1", name: "Senior 1" }],
      streams: [],
    });
    const result = await listEnrolledStudents(db, SCHOOL_CODE);
    expect(result).toHaveLength(1);
    expect(result[0].className).toBe("Senior 1");
    expect(result[0].streamName).toBe("Unknown stream");
  });

  it("returns 'Unknown class' and 'Unknown stream' when both FK records are missing", async () => {
    const db = makeFakeDb({
      enrollmentRow: makeEnrollmentRow({ classId: "class-orphaned", streamId: "stream-orphaned" }),
      classes: [],
      streams: [],
    });
    const result = await listEnrolledStudents(db, SCHOOL_CODE);
    expect(result).toHaveLength(1);
    expect(result[0].className).toBe("Unknown class");
    expect(result[0].streamName).toBe("Unknown stream");
    expect(result[0].studentName).toBe("Alice Smith");
    expect(result[0].admissionNumber).toBe("S001");
  });

  it("returns real class/stream names when both FK records are present", async () => {
    const db = makeFakeDb({
      enrollmentRow: makeEnrollmentRow({ classId: "class-1", streamId: "stream-1" }),
      classes: [{ id: "class-1", name: "Senior 2" }],
      streams: [{ id: "stream-1", name: "West", code: "W" }],
    });
    const result = await listEnrolledStudents(db, SCHOOL_CODE);
    expect(result).toHaveLength(1);
    expect(result[0].className).toBe("Senior 2");
    expect(result[0].streamName).toBe("West");
  });

  it("does not throw when classEnrollment.findMany returns an empty list", async () => {
    const db = {
      school: {
        findUnique: async () => ({
          id: SCHOOL_ID,
          code: SCHOOL_CODE,
          name: "Test School",
          academicYears: [{ id: YEAR_ID, isActive: true, terms: [{ id: TERM_ID, isActive: true }] }],
        }),
      },
      classEnrollment: { findMany: async () => [] },
      schoolClass: { findMany: async () => [] },
      stream: { findMany: async () => [] },
    } as unknown as PrismaClient;

    const result = await listEnrolledStudents(db, SCHOOL_CODE);
    expect(result).toHaveLength(0);
  });
});

