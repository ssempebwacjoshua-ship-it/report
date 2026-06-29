import { describe, expect, it } from "vitest";
import type { StudentReportCard } from "../../shared/types/reports";
import { sanitizeReportCardForRender } from "../../shared/utils/reportContentLimits";

function buildCard(overrides: Partial<StudentReportCard> = {}): StudentReportCard {
  return {
    studentId: "student-1",
    admissionNumber: "S-001",
    studentName: "Grace Hopper",
    passportPhotoUrl: "/uploads/students/demo/photo.webp",
    className: "Senior 1",
    streamName: "A",
    academicYear: "2025",
    term: "Term 1",
    marksFound: 12,
    totalSubjects: 8,
    average: 76,
    grade: "B",
    overallPosition: 1,
    readiness: "READY",
    missingMarks: [],
    comments: "Great effort.",
    contactReadiness: "READY",
    contactSummary: "Primary guardian available.",
    subjects: [],
    progressionText: null,
    ...overrides,
  };
}

describe("sanitizeReportCardForRender", () => {
  it("keeps local upload URLs for passport photos", () => {
    const card = sanitizeReportCardForRender(buildCard());
    expect(card.passportPhotoUrl).toBe("/uploads/students/demo/photo.webp");
  });

  it("keeps Cloudinary HTTPS passport photo URLs", () => {
    const card = sanitizeReportCardForRender(
      buildCard({
        passportPhotoUrl: "https://res.cloudinary.com/demo/image/upload/v1/school-connect/students/demo/photo.webp",
      }),
    );

    expect(card.passportPhotoUrl).toContain("https://res.cloudinary.com/");
  });
});
