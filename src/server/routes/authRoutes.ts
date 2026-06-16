import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { signToken, verifyPassword, verifyToken } from "../services/authService";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  schoolCode: z.string().min(1, "School code is required."),
});

export function authRoutes() {
  const router = Router();

  router.post("/api/auth/login", async (req, res, next) => {
    try {
      console.log("auth.login.request");
      const { email, password, schoolCode } = loginSchema.parse(req.body);

      const school = await prisma.school.findUnique({ where: { code: schoolCode } });
      if (!school) {
        console.log("auth.login.school", { found: false });
        res.status(401).json({ error: "Invalid credentials." });
        return;
      }
      console.log("auth.login.school", { found: true });

      const user = await prisma.user.findFirst({
        where: { schoolId: school.id, email: email.toLowerCase(), isActive: true },
      });
      console.log("auth.login.user", { found: !!user });

      const passwordMatch = user ? await verifyPassword(password, user.passwordHash) : false;
      console.log("auth.login.password", { matched: passwordMatch });

      if (!user || !passwordMatch) {
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

      console.log("auth.login.session", { success: true });
      console.log("auth.login.response", { status: 200 });

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
