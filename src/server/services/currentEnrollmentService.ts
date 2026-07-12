import type { PrismaClient } from "@prisma/client";

export type CurrentEnrollmentFilters = {
  classId?: string;
  streamId?: string;
  search?: string;
  studentType?: "ALL" | "DAY" | "BOARDING" | "DAY_SCHOLAR" | "BOARDER";
};

type CurrentEnrollmentDb = Pick<PrismaClient, "school" | "student">;

export type CurrentEnrolledStudent = {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  attendanceProfile?: "DAY_SCHOLAR" | "BOARDER" | null;
  studentType: "DAY" | "BOARDING" | null;
  enrollments: Array<{
    class: { name: string } | null;
    stream: { name: string } | null;
  }>;
};

export type CurrentEnrollmentScope = {
  academicYearId: string;
  academicYearName: string;
  termId: string;
  termName: string;
};

function toAttendanceProfileFilter(value: CurrentEnrollmentFilters["studentType"]) {
  if (value === "DAY" || value === "DAY_SCHOLAR") return "DAY_SCHOLAR" as const;
  if (value === "BOARDING" || value === "BOARDER") return "BOARDER" as const;
  return undefined;
}

function buildStudentSearch(search?: string) {
  const query = search?.trim();
  if (!query) return {};
  return {
    OR: [
      { firstName: { contains: query, mode: "insensitive" as const } },
      { lastName: { contains: query, mode: "insensitive" as const } },
      { admissionNumber: { contains: query, mode: "insensitive" as const } },
    ],
  };
}

export async function getCurrentEnrollmentScope(
  db: CurrentEnrollmentDb,
  schoolId: string,
): Promise<CurrentEnrollmentScope | null> {
  const school = await db.school.findUnique({
    where: { id: schoolId },
    include: {
      academicYears: {
        where: { isActive: true },
        include: { terms: { where: { isActive: true } } },
      },
    },
  });

  const activeYear = school?.academicYears[0];
  const activeTerm = activeYear?.terms[0];

  if (!school || !activeYear || !activeTerm) {
    return null;
  }

  return {
    academicYearId: activeYear.id,
    academicYearName: activeYear.name,
    termId: activeTerm.id,
    termName: activeTerm.name,
  };
}

function buildCurrentEnrollmentWhere(
  schoolId: string,
  scope: CurrentEnrollmentScope,
  filters: CurrentEnrollmentFilters = {},
) {
  const attendanceProfile = toAttendanceProfileFilter(filters.studentType);
  const enrollmentWhere = {
    academicYearId: scope.academicYearId,
    termId: scope.termId,
    isActive: true,
    status: "ACTIVE" as const,
    classId: filters.classId || undefined,
    streamId: filters.streamId || undefined,
  };

  return {
    schoolId,
    isActive: true,
    ...(attendanceProfile ? { attendanceProfile } : {}),
    ...buildStudentSearch(filters.search),
    enrollments: {
      some: enrollmentWhere,
    },
  };
}

export async function countCurrentEnrolledStudents(
  db: CurrentEnrollmentDb,
  schoolId: string,
  filters: CurrentEnrollmentFilters = {},
): Promise<number> {
  const scope = await getCurrentEnrollmentScope(db, schoolId);
  if (!scope) {
    return 0;
  }

  return db.student.count({
    where: buildCurrentEnrollmentWhere(schoolId, scope, filters),
  });
}

export async function listCurrentEnrolledStudents(
  db: CurrentEnrollmentDb,
  schoolId: string,
  filters: CurrentEnrollmentFilters = {},
): Promise<CurrentEnrolledStudent[]> {
  const scope = await getCurrentEnrollmentScope(db, schoolId);
  if (!scope) {
    return [];
  }

  const enrollmentWhere = {
    academicYearId: scope.academicYearId,
    termId: scope.termId,
    isActive: true,
    status: "ACTIVE" as const,
    classId: filters.classId || undefined,
    streamId: filters.streamId || undefined,
  };

  return db.student.findMany({
    where: buildCurrentEnrollmentWhere(schoolId, scope, filters),
    select: {
      id: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
      attendanceProfile: true,
      studentType: true,
      enrollments: {
        where: enrollmentWhere,
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          class: { select: { name: true } },
          stream: { select: { name: true } },
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}
