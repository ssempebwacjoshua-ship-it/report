import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../server/db/prisma";
import { resolveCommunicationAudience } from "../../server/services/communicationAudienceService";

const SCHOOL_CODE = "COMM-AUDIENCE-TEST";
const OTHER_SCHOOL_CODE = "COMM-AUDIENCE-OTHER";

type SchoolContext = {
  schoolId: string;
  academicYearId: string;
  termId: string;
  classId: string;
  streamId: string;
};

let school: SchoolContext;
let otherSchool: SchoolContext;

async function cleanupSchool(schoolId: string) {
  await prisma.communicationDeliveryAttempt.deleteMany({ where: { delivery: { schoolId } } });
  await prisma.communicationDelivery.deleteMany({ where: { schoolId } });
  await prisma.communicationRecipient.deleteMany({ where: { schoolId } });
  await prisma.communicationAudienceSnapshot.deleteMany({ where: { campaign: { schoolId } } });
  await prisma.communicationAudience.deleteMany({ where: { campaign: { schoolId } } });
  await prisma.communicationConsent.deleteMany({ where: { schoolId } });
  await prisma.communicationCampaign.deleteMany({ where: { schoolId } });
  await prisma.guardianContact.deleteMany({ where: { schoolId } });
  await prisma.classEnrollment.deleteMany({ where: { schoolId } });
  await prisma.studentFeeHold.deleteMany({ where: { schoolId } });
  await prisma.dailyAttendance.deleteMany({ where: { schoolId } });
  await prisma.stream.deleteMany({ where: { schoolId } });
  await prisma.schoolClass.deleteMany({ where: { schoolId } });
  await prisma.term.deleteMany({ where: { academicYear: { schoolId } } });
  await prisma.academicYear.deleteMany({ where: { schoolId } });
  await prisma.student.deleteMany({ where: { schoolId } });
}

async function prepareSchool(code: string, name: string): Promise<SchoolContext> {
  const record = await prisma.school.upsert({
    where: { code },
    update: { name },
    create: { code, name },
    select: { id: true },
  });
  await cleanupSchool(record.id);
  const academicYear = await prisma.academicYear.create({
    data: {
      schoolId: record.id,
      name: "2025/2026",
      startsOn: new Date("2025-02-01T00:00:00.000Z"),
      endsOn: new Date("2026-01-31T23:59:59.999Z"),
      isActive: true,
    },
  });
  const term = await prisma.term.create({
    data: {
      academicYearId: academicYear.id,
      name: "Term 1",
      startsOn: new Date("2025-02-01T00:00:00.000Z"),
      endsOn: new Date("2025-05-31T23:59:59.999Z"),
      isActive: true,
    },
  });
  const klass = await prisma.schoolClass.create({
    data: {
      schoolId: record.id,
      name: "Senior 1",
      code: "S1",
      level: 1,
    },
  });
  const stream = await prisma.stream.create({
    data: {
      schoolId: record.id,
      classId: klass.id,
      name: "A",
      code: "A",
    },
  });
  return {
    schoolId: record.id,
    academicYearId: academicYear.id,
    termId: term.id,
    classId: klass.id,
    streamId: stream.id,
  };
}

async function seedStudent(input: {
  schoolId: string;
  academicYearId: string;
  termId: string;
  classId: string;
  streamId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  isActive?: boolean;
  guardianName: string;
  relationship: string;
  phone?: string | null;
  email?: string | null;
  preferredContactMethod?: "PHONE" | "SMS" | "EMAIL" | "WHATSAPP";
  canReceiveReports?: boolean;
}) {
  const student = await prisma.student.create({
    data: {
      schoolId: input.schoolId,
      admissionNumber: input.admissionNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      isActive: input.isActive ?? true,
    },
  });
  await prisma.classEnrollment.create({
    data: {
      schoolId: input.schoolId,
      studentId: student.id,
      academicYearId: input.academicYearId,
      termId: input.termId,
      classId: input.classId,
      streamId: input.streamId,
      isActive: true,
      status: "ACTIVE",
    },
  });
  await prisma.guardianContact.create({
    data: {
      schoolId: input.schoolId,
      studentId: student.id,
      guardianName: input.guardianName,
      relationship: input.relationship,
      phone: input.phone ?? null,
      email: input.email ?? null,
      preferredContactMethod: input.preferredContactMethod ?? (input.phone ? "PHONE" : "EMAIL"),
      isPrimary: true,
      canReceiveReports: input.canReceiveReports ?? true,
    },
  });
  return student;
}

beforeAll(async () => {
  school = await prepareSchool(SCHOOL_CODE, "Communication Audience Test");
  otherSchool = await prepareSchool(OTHER_SCHOOL_CODE, "Communication Audience Other");
});

beforeEach(async () => {
  await cleanupSchool(school.schoolId);
  await cleanupSchool(otherSchool.schoolId);
  school = await prepareSchool(SCHOOL_CODE, "Communication Audience Test");
  otherSchool = await prepareSchool(OTHER_SCHOOL_CODE, "Communication Audience Other");
});

describe.sequential("communicationAudienceService", () => {
  it("keeps audience resolution inside the current school context", async () => {
    await seedStudent({
      ...school,
      admissionNumber: "AUD-001",
      firstName: "Ada",
      lastName: "One",
      guardianName: "Parent One",
      relationship: "Mother",
      phone: "0774549869",
      email: "parent1@example.test",
    });
    await seedStudent({
      ...school,
      admissionNumber: "AUD-002",
      firstName: "Ada",
      lastName: "Two",
      guardianName: "Parent Two",
      relationship: "Mother",
      phone: "0774550001",
      email: "parent2@example.test",
    });
    await seedStudent({
      ...otherSchool,
      admissionNumber: "AUD-900",
      firstName: "Outside",
      lastName: "School",
      guardianName: "Outside Parent",
      relationship: "Mother",
      phone: "0774559999",
      email: "outside@example.test",
    });

    const result = await resolveCommunicationAudience(prisma, {
      schoolId: school.schoolId,
      schoolName: "Communication Audience Test",
    }, {
      audienceType: "ALL_PARENTS_GUARDIANS",
      channel: "WHATSAPP",
      page: 1,
      pageSize: 20,
      mode: "GENERAL",
    });

    expect(result.matchedStudentsCount).toBe(2);
    expect(result.eligibleRecipientsCount).toBe(2);
    expect(result.totalRecipients).toBe(2);
    expect(result.recipients.every((row) => row.studentName.includes("Outside"))).toBe(false);
  });

  it("dedupes sibling guardians on the class audience", async () => {
    await seedStudent({
      ...school,
      admissionNumber: "AUD-003",
      firstName: "Sibling",
      lastName: "One",
      guardianName: "Shared Parent",
      relationship: "Mother",
      phone: "0774551000",
      email: "shared@example.test",
    });
    await seedStudent({
      ...school,
      admissionNumber: "AUD-004",
      firstName: "Sibling",
      lastName: "Two",
      guardianName: "Shared Parent",
      relationship: "Mother",
      phone: "0774551000",
      email: "shared@example.test",
    });

    const result = await resolveCommunicationAudience(prisma, {
      schoolId: school.schoolId,
      schoolName: "Communication Audience Test",
    }, {
      audienceType: "PARENTS_BY_CLASS",
      classId: school.classId,
      channel: "WHATSAPP",
      page: 1,
      pageSize: 20,
      mode: "GENERAL",
    });

    expect(result.matchedStudentsCount).toBe(2);
    expect(result.eligibleRecipientsCount).toBe(1);
    expect(result.duplicateContactsRemovedCount).toBe(1);
    expect(result.recipients.some((row) => row.eligibilityStatus === "DUPLICATE_CONTACT")).toBe(true);
    expect(result.recipients.some((row) => row.eligibilityStatus === "ELIGIBLE")).toBe(true);
  });

  it("honors channel availability and excludes inactive students by default", async () => {
    await seedStudent({
      ...school,
      admissionNumber: "AUD-005",
      firstName: "Phone",
      lastName: "Only",
      guardianName: "Phone Parent",
      relationship: "Father",
      phone: "0774552000",
      email: "",
    });
    await seedStudent({
      ...school,
      admissionNumber: "AUD-006",
      firstName: "Email",
      lastName: "Only Active",
      guardianName: "Email Parent",
      relationship: "Guardian",
      phone: "",
      email: "email.active@example.test",
    });
    await seedStudent({
      ...school,
      admissionNumber: "AUD-007",
      firstName: "Email",
      lastName: "Only",
      isActive: false,
      guardianName: "Email Parent",
      relationship: "Guardian",
      phone: "",
      email: "email.parent@example.test",
    });

    const whatsapp = await resolveCommunicationAudience(prisma, {
      schoolId: school.schoolId,
      schoolName: "Communication Audience Test",
    }, {
      audienceType: "ALL_PARENTS_GUARDIANS",
      channel: "WHATSAPP",
      page: 1,
      pageSize: 20,
      mode: "GENERAL",
    });

    expect(whatsapp.eligibleRecipientsCount).toBe(1);
    expect(whatsapp.recipients.some((row) => row.eligibilityStatus === "INACTIVE_STUDENT")).toBe(true);
    expect(whatsapp.recipients.some((row) => row.eligibilityStatus === "MISSING_PHONE")).toBe(true);

    const email = await resolveCommunicationAudience(prisma, {
      schoolId: school.schoolId,
      schoolName: "Communication Audience Test",
    }, {
      audienceType: "ALL_PARENTS_GUARDIANS",
      channel: "EMAIL",
      page: 1,
      pageSize: 20,
      mode: "GENERAL",
    });

    expect(email.eligibleRecipientsCount).toBe(1);
    expect(email.recipients.some((row) => row.eligibilityStatus === "MISSING_EMAIL")).toBe(true);
  });
});
