import { Router } from "express";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db/prisma";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

function signCreatorToken(creatorId: string, email: string, name: string): string {
  return jwt.sign({ creatorId, email, name }, JWT_SECRET, { expiresIn: "30d" });
}

// External creator signup
router.post("/signup", async (req, res) => {
  const { email, name, password } = req.body as { email?: string; name?: string; password?: string };

  if (!email?.trim() || !name?.trim() || !password) {
    res.status(400).json({ error: "Email, name, and password are required." });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existing = await (prisma as any).creator.findFirst({ where: { email: normalizedEmail } });
    if (existing) {
      res.status(409).json({ error: "An account with that email already exists." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const creator = await (prisma as any).creator.create({
      data: { id: randomUUID(), type: "EXTERNAL", email: normalizedEmail, name: name.trim(), passwordHash },
    });

    const token = signCreatorToken(creator.id as string, creator.email as string, creator.name as string);
    res.status(201).json({
      ok: true,
      token,
      creator: { id: creator.id, email: creator.email, name: creator.name, type: creator.type },
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Signup failed." });
  }
});

// External creator login
router.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email?.trim() || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const creator = await (prisma as any).creator.findFirst({
      where: { email: normalizedEmail, type: "EXTERNAL" },
    });

    if (!creator?.passwordHash) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }
    if (!creator.isActive) {
      res.status(403).json({ error: "Account is disabled." });
      return;
    }

    const valid = await bcrypt.compare(password, creator.passwordHash as string);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }

    const token = signCreatorToken(creator.id as string, creator.email as string, creator.name as string);
    res.json({
      ok: true,
      token,
      creator: { id: creator.id, email: creator.email, name: creator.name, type: creator.type },
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Login failed." });
  }
});

export function creatorAuthRoutes() {
  return router;
}
