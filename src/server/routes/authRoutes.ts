import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { signToken, verifyPassword, verifyToken } from "../services/authService";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  schoolCode: z.string().default("SCU-PREVIEW"),
});

export function authRoutes() {
  const router = Router();

  router.post("/api/auth/login", async (req, res, next) => {
    try {
      const { email, password, schoolCode } = loginSchema.parse(req.body);

      const school = await prisma.school.findUnique({ where: { code: schoolCode } });
      if (!school) {
        res.status(401).json({ error: "Invalid credentials." });
        return;
      }

      const user = await prisma.user.findFirst({
        where: { schoolId: school.id, email: email.toLowerCase(), isActive: true },
      });

      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        res.status(401).json({ error: "Invalid credentials." });
        return;
      }

      const token = signToken({
        userId: user.id,
        schoolId: user.schoolId,
        name: user.name,
        email: user.email,
        role: user.role,
      });

      res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/auth/me", async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

      if (!token) {
        res.status(401).json({ error: "Not authenticated." });
        return;
      }

      const payload = verifyToken(token);
      if (!payload) {
        res.status(401).json({ error: "Invalid or expired session." });
        return;
      }

      res.json({
        user: {
          id: payload.userId,
          name: payload.name,
          email: payload.email,
          role: payload.role,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/auth/logout", (_req, res) => {
    res.json({ ok: true });
  });

  return router;
}
