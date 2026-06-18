import { Router } from "express";
import { prisma } from "../db/prisma";

export function verifyRoutes() {
  const router = Router();

  // Public ? anyone can verify a reference code
  router.get("/api/verify/:code", async (req, res, next) => {
    try {
      const code = req.params.code.toUpperCase();

      const issued = await prisma.issuedReport.findUnique({
        where: { referenceCode: code },
        include: {
          school: { select: { name: true } },
          student: { select: { firstName: true, lastName: true } },
        },
      });

      if (!issued) {
        res.status(404).json({
          found: false,
          status: null,
          message: "No report found with this reference code.",
        });
        return;
      }

      const initials =
        `${issued.student.firstName.charAt(0).toUpperCase()}.${issued.student.lastName.charAt(0).toUpperCase()}.`;

      res.json({
        found: true,
        status: issued.status,
        referenceCode: issued.referenceCode,
        schoolName: issued.school.name,
        studentInitials: initials,
        academicYear: issued.academicYear,
        term: issued.term,
        assessmentType: issued.assessmentType,
        issuedAt: issued.issuedAt,
        issuedByName: issued.issuedByName,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

