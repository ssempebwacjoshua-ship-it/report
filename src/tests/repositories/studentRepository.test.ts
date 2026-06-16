import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { listEnrolledStudents } from "../../server/repositories/studentRepository";

const SCHOOL_CODE = "SCU-TEST";
const SCHOOL_ID = "school-1";
const YEAR_ID = "year-1";
const TERM_ID = "term-1";

function makeEnrollment(overrides: {
  classRecord: { id: string; name: string } | null;
  streamRecord: { id: string; name: string; code: string } | null;
}) {
  return {
    id: "enrollment-1",
    studentId: "student-1",
    schoolId: SCHOOL_ID,
    academicYearId: YEAR_ID,
    termId: TERM_ID,
    classId: overrides.classRecord?.id ?? "class-orphaned",
    streamId: overrides.streamRecord?.id ?? "stream-orphaned",
    isActive: true,
    status: "ACTIVE",
    class: overrides.classRecord as unknown as { id: string; name: string },
    stream: overrides.streamRecord as unknown as { id: string; name: string; code: string },
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

function makeFakeDb(enrollmentRow: ReturnType<typeof makeEnrollment>) {
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
      findMany: async () => [enrollmentRow],
    },
  } as unknown as PrismaClient;
}

describe("listEnrolledStudents — null class/stream fallbacks", () => {
  it("returns 'Unknown class' when the class FK record is missing", async () => {
    const db = makeFakeDb(makeEnrollment({ classRecord: null, streamRecord: { id: "stream-1", name: "Stream A", code: "A" } }));
    const result = await listEnrolledStudents(db, SCHOOL_CODE);
    expect(result).toHaveLength(1);
    expect(result[0].className).toBe("Unknown class");
    expect(result[0].streamName).toBe("Stream A");
  });

  it("returns 'Unknown stream' when the stream FK record is missing", async () => {
    const db = makeFakeDb(makeEnrollment({ classRecord: { id: "class-1", name: "Senior 1" }, streamRecord: null }));
    const result = await listEnrolledStudents(db, SCHOOL_CODE);
    expect(result).toHaveLength(1);
    expect(result[0].className).toBe("Senior 1");
    expect(result[0].streamName).toBe("Unknown stream");
  });

  it("returns 'Unknown class' and 'Unknown stream' when both FK records are missing", async () => {
    const db = makeFakeDb(makeEnrollment({ classRecord: null, streamRecord: null }));
    const result = await listEnrolledStudents(db, SCHOOL_CODE);
    expect(result).toHaveLength(1);
    expect(result[0].className).toBe("Unknown class");
    expect(result[0].streamName).toBe("Unknown stream");
    // Student data still intact
    expect(result[0].studentName).toBe("Alice Smith");
    expect(result[0].admissionNumber).toBe("S001");
  });

  it("returns real class/stream names when both FK records are present", async () => {
    const db = makeFakeDb(
      makeEnrollment({
        classRecord: { id: "class-1", name: "Senior 2" },
        streamRecord: { id: "stream-1", name: "West", code: "W" },
      }),
    );
    const result = await listEnrolledStudents(db, SCHOOL_CODE);
    expect(result).toHaveLength(1);
    expect(result[0].className).toBe("Senior 2");
    expect(result[0].streamName).toBe("West");
  });
});
