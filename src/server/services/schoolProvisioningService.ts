import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "./authService";
import { getClassesForSections, type SchoolSection } from "../../shared/constants/classes";

export type ProvisionSchoolInput = {
  schoolCode: string;
  schoolName: string;
  sections: SchoolSection[];
  adminEmail: string;
  adminName: string;
  adminPassword: string;
};

export type ProvisionSchoolResult = {
  school: { id: string; code: string; name: string };
  classesSeeded: number;
  admin: { id: string; email: string; schoolId: string; role: string };
};

export async function provisionSchool(
  prisma: PrismaClient,
  input: ProvisionSchoolInput,
): Promise<ProvisionSchoolResult> {
  let school = await prisma.school.findUnique({ where: { code: input.schoolCode } });
  if (!school) {
    school = await prisma.school.create({
      data: { code: input.schoolCode, name: input.schoolName },
    });
  }

  const classDefs = getClassesForSections(input.sections);
  for (const def of classDefs) {
    await prisma.schoolClass.upsert({
      where: { schoolId_code: { schoolId: school.id, code: def.code } },
      create: { schoolId: school.id, name: def.name, code: def.code, level: def.level },
      update: {},
    });
  }
  const classesSeeded = classDefs.length;

  const passwordHash = await hashPassword(input.adminPassword);
  const normalizedEmail = input.adminEmail.toLowerCase();
  const existingUser = await prisma.user.findFirst({
    where: { schoolId: school.id, email: normalizedEmail },
  });

  const admin = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: { name: input.adminName, passwordHash, isActive: true, role: "ADMIN_OPERATOR" },
      })
    : await prisma.user.create({
        data: {
          schoolId: school.id,
          name: input.adminName,
          email: normalizedEmail,
          passwordHash,
          role: "ADMIN_OPERATOR",
          isActive: true,
        },
      });

  await prisma.auditLog.create({
    data: {
      schoolId: school.id,
      action: "school.provisioned",
      details: {
        schoolCode: school.code,
        schoolName: school.name,
        sections: input.sections,
        classesSeeded,
        adminEmail: admin.email,
      },
    },
  });

  return {
    school: { id: school.id, code: school.code, name: school.name },
    classesSeeded,
    admin: { id: admin.id, email: admin.email, schoolId: admin.schoolId, role: admin.role },
  };
}
