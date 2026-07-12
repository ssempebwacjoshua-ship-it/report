import "dotenv/config";
import { pathToFileURL } from "node:url";
import { prisma } from "../src/server/db/prisma";
import { describeWriteMode } from "../src/server/services/authScriptSafety";
import { assertNonProductionOperation, classifyRuntimeEnvironment } from "../src/server/security/environmentSafety";
import { O_LEVEL_SUBJECTS } from "../src/shared/constants/subjects";
import { getPlanByCode } from "../src/shared/constants/subscriptionPlans";

export const PREVIEW_SCHOOL_CODE = "SCU-PREVIEW";

const students = [
  {
    firstName: "Kampala",
    lastName: "Ssempebwa",
    admissionNumber: "S1A-001",
    stream: "A",
    contact: { guardianName: "Agnes Namusoke", relationship: "Mother", phone: "+256700100001", email: "agnes.namusoke@example.test", preferredContactMethod: "EMAIL" as const, canReceiveReports: true },
  },
  {
    firstName: "Brian",
    lastName: "Mugisha",
    admissionNumber: "S1A-002",
    stream: "A",
    contact: { guardianName: "Patrick Mugisha", relationship: "Father", phone: "+256700100002", email: "", preferredContactMethod: "SMS" as const, canReceiveReports: true },
  },
  {
    firstName: "Cynthia",
    lastName: "Okello",
    admissionNumber: "S1A-003",
    stream: "A",
    contact: { guardianName: "Sarah Okello", relationship: "Aunt", phone: "", email: "sarah.okello@example.test", preferredContactMethod: "EMAIL" as const, canReceiveReports: true },
  },
  {
    firstName: "David",
    lastName: "Kasozi",
    admissionNumber: "S1A-004",
    stream: "A",
    contact: { guardianName: "Joseph Kasozi", relationship: "Guardian", phone: "", email: "", preferredContactMethod: "PHONE" as const, canReceiveReports: false },
  },
  {
    firstName: "Esther",
    lastName: "Nakayiza",
    admissionNumber: "S1B-001",
    stream: "B",
    contact: { guardianName: "Florence Nakayiza", relationship: "Mother", phone: "+256700100005", email: "florence.nakayiza@example.test", preferredContactMethod: "WHATSAPP" as const, canReceiveReports: true },
  },
  {
    firstName: "Felix",
    lastName: "Namagembe",
    admissionNumber: "S1B-002",
    stream: "B",
    contact: { guardianName: "Robert Namagembe", relationship: "Father", phone: "+256700100006", email: "robert.namagembe@example.test", preferredContactMethod: "SMS" as const, canReceiveReports: true },
  },
  {
    firstName: "Grace",
    lastName: "Achen",
    admissionNumber: "S1B-003",
    stream: "B",
    contact: { guardianName: "Milly Achen", relationship: "Mother", phone: "+256700100007", email: "", preferredContactMethod: "PHONE" as const, canReceiveReports: true },
  },
];

export async function seedPreviewData() {
  const school = await prisma.school.upsert({
    where: { code: PREVIEW_SCHOOL_CODE },
    update: { name: "School Connect Preview School" },
    create: { code: PREVIEW_SCHOOL_CODE, name: "School Connect Preview School" },
  });

  const academicYear = await prisma.academicYear.upsert({
    where: { schoolId_name: { schoolId: school.id, name: "2025/2026" } },
    update: { isActive: true },
    create: {
      schoolId: school.id,
      name: "2025/2026",
      startsOn: new Date("2025-02-01"),
      endsOn: new Date("2026-12-01"),
      isActive: true,
    },
  });

  await prisma.academicYear.updateMany({
    where: { schoolId: school.id, id: { not: academicYear.id } },
    data: { isActive: false },
  });

  const term = await prisma.term.upsert({
    where: { academicYearId_name: { academicYearId: academicYear.id, name: "Term 1" } },
    update: { isActive: true },
    create: {
      academicYearId: academicYear.id,
      name: "Term 1",
      startsOn: new Date("2026-02-01"),
      endsOn: new Date("2026-05-15"),
      isActive: true,
    },
  });

  await prisma.term.updateMany({
    where: { academicYearId: academicYear.id, id: { not: term.id } },
    data: { isActive: false },
  });

  const s1a = await prisma.schoolClass.upsert({
    where: { schoolId_code: { schoolId: school.id, code: "S1A" } },
    update: { name: "Senior 1 A", level: 1 },
    create: { schoolId: school.id, code: "S1A", name: "Senior 1 A", level: 1 },
  });
  const s1b = await prisma.schoolClass.upsert({
    where: { schoolId_code: { schoolId: school.id, code: "S1B" } },
    update: { name: "Senior 1 B", level: 1 },
    create: { schoolId: school.id, code: "S1B", name: "Senior 1 B", level: 1 },
  });

  const streamA = await prisma.stream.upsert({
    where: { classId_code: { classId: s1a.id, code: "A" } },
    update: { name: "A", schoolId: school.id },
    create: { schoolId: school.id, classId: s1a.id, code: "A", name: "A" },
  });
  const streamB = await prisma.stream.upsert({
    where: { classId_code: { classId: s1b.id, code: "B" } },
    update: { name: "B", schoolId: school.id },
    create: { schoolId: school.id, classId: s1b.id, code: "B", name: "B" },
  });

  for (const [index, subject] of O_LEVEL_SUBJECTS.entries()) {
    await prisma.subject.upsert({
      where: { schoolId_code: { schoolId: school.id, code: subject.code } },
      update: { name: subject.name, sortOrder: index + 1, isActive: true },
      create: { schoolId: school.id, code: subject.code, name: subject.name, sortOrder: index + 1, isActive: true },
    });
  }

  for (const studentSeed of students) {
    const student = await prisma.student.upsert({
      where: { schoolId_admissionNumber: { schoolId: school.id, admissionNumber: studentSeed.admissionNumber } },
      update: { firstName: studentSeed.firstName, lastName: studentSeed.lastName, isActive: true },
      create: {
        schoolId: school.id,
        firstName: studentSeed.firstName,
        lastName: studentSeed.lastName,
        admissionNumber: studentSeed.admissionNumber,
        isActive: true,
      },
    });
    const klass = studentSeed.stream === "A" ? s1a : s1b;
    const stream = studentSeed.stream === "A" ? streamA : streamB;
    await prisma.classEnrollment.upsert({
      where: { studentId_academicYearId_termId: { studentId: student.id, academicYearId: academicYear.id, termId: term.id } },
      update: { classId: klass.id, streamId: stream.id, isActive: true, status: "ACTIVE", leftAt: null },
      create: {
        studentId: student.id,
        academicYearId: academicYear.id,
        termId: term.id,
        classId: klass.id,
        streamId: stream.id,
        isActive: true,
        status: "ACTIVE",
        enrolledAt: new Date("2026-02-01"),
      },
    });
    await prisma.guardianContact.upsert({
      where: {
        studentId_guardianName_relationship: {
          studentId: student.id,
          guardianName: studentSeed.contact.guardianName,
          relationship: studentSeed.contact.relationship,
        },
      },
      update: {
        phone: studentSeed.contact.phone || null,
        email: studentSeed.contact.email || null,
        preferredContactMethod: studentSeed.contact.preferredContactMethod,
        isPrimary: true,
        canReceiveReports: studentSeed.contact.canReceiveReports,
        notes: "Preview report contact",
      },
      create: {
        schoolId: school.id,
        studentId: student.id,
        guardianName: studentSeed.contact.guardianName,
        relationship: studentSeed.contact.relationship,
        phone: studentSeed.contact.phone || null,
        email: studentSeed.contact.email || null,
        preferredContactMethod: studentSeed.contact.preferredContactMethod,
        isPrimary: true,
        canReceiveReports: studentSeed.contact.canReceiveReports,
        notes: "Preview report contact",
      },
    });
  }

  // Subscription — REPORT_LAB_1000 for SCU-PREVIEW, active for one year from seed date
  const PLAN_CODE = "REPORT_LAB_1000";
  const plan = getPlanByCode(PLAN_CODE)!;
  const periodStart = new Date("2026-06-16T00:00:00.000Z");
  const periodEnd = new Date("2027-06-16T00:00:00.000Z");

  const sub = await prisma.reportLabSubscription.upsert({
    where: { schoolId: school.id },
    update: {
      planCode: PLAN_CODE,
      studentLimit: plan.studentLimit,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      status: "ACTIVE",
    },
    create: {
      schoolId: school.id,
      planCode: PLAN_CODE,
      billingCycle: "YEAR",
      studentLimit: plan.studentLimit,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      status: "ACTIVE",
    },
  });

  // Create invoice only if there are none yet (idempotent-friendly)
  const invoiceCount = await prisma.reportLabInvoice.count({ where: { subscriptionId: sub.id } });
  if (invoiceCount === 0) {
    await prisma.reportLabInvoice.create({
      data: {
        subscriptionId: sub.id,
        setupFeeUgx: 500_000,
        amountUgx: 600_000,
        totalUgx: 1_100_000,
        status: "PAID",
        paidAt: periodStart,
        notes: "Initial setup — School Connect Preview",
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      schoolId: school.id,
      action: "seed.preview",
      correlationId: "reports-lab-preview-seed",
      details: { subjects: O_LEVEL_SUBJECTS.length, students: students.length },
    },
  });

  return { school, academicYear, term, classes: [s1a, s1b], streams: [streamA, streamB], students: students.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const { mode } = describeWriteMode(args);
  const classification = classifyRuntimeEnvironment(process.env);
  console.log(`[seed-preview] mode=${mode} environment=${classification.environment}`);

  if (mode === "dry-run") {
    console.log(`[seed-preview] Would seed preview data for ${PREVIEW_SCHOOL_CODE}.`);
    await prisma.$disconnect();
  } else {
    assertNonProductionOperation("seed-preview", process.env);
    seedPreviewData()
      .then((result) => {
        console.log(`Seeded ${result.school.code}: ${result.students} students, ${O_LEVEL_SUBJECTS.length} subjects.`);
      })
      .finally(async () => prisma.$disconnect());
  }
}
