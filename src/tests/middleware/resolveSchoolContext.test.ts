import request from "supertest";
import express from "express";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { resolveSchoolContext } from "../../server/middleware/resolveSchoolContext";
import { signToken } from "../../server/services/authService";
import { hashPassword } from "../../server/services/authService";
import { prisma } from "../../server/db/prisma";

let schoolAToken: string;
let previewSchoolId: string;
let previewUserId: string;
const originalNodeEnv = process.env.NODE_ENV;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(resolveSchoolContext);
  app.get("/probe", (_req, res) => res.json({ ok: true }));
  return app;
}

beforeAll(async () => {
  const school = await prisma.school.findUniqueOrThrow({
    where: { code: "SCU-PREVIEW" },
    select: { id: true, code: true, name: true },
  });
  previewSchoolId = school.id;

  const email = "resolve-school-context-test@schoolconnect.test";
  const passwordHash = await hashPassword("ResolveSchoolContextTestPass123!");
  const user = await prisma.user.upsert({
    where: {
      schoolId_email: {
        schoolId: school.id,
        email,
      },
    },
    update: {
      name: "Resolve School Context Test Admin",
      role: "ADMIN_OPERATOR",
      isActive: true,
      passwordHash,
      tokenVersion: 0,
      mustChangePassword: false,
    },
    create: {
      schoolId: school.id,
      name: "Resolve School Context Test Admin",
      email,
      role: "ADMIN_OPERATOR",
      isActive: true,
      passwordHash,
      tokenVersion: 0,
      mustChangePassword: false,
    },
    select: {
      id: true,
      schoolId: true,
      name: true,
      email: true,
      role: true,
      tokenVersion: true,
    },
  });

  previewUserId = user.id;
  schoolAToken = signToken({
    userId: user.id,
    schoolId: user.schoolId,
    name: user.name,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe("resolveSchoolContext ? cross-tenant isolation", () => {
  it("passes when token school matches the requested schoolCode", async () => {
    const res = await request(createApp())
      .get("/probe?schoolCode=SCU-PREVIEW")
      .set("Authorization", `Bearer ${schoolAToken}`);
    expect(res.status).toBe(200);
  });

  it("returns 403 when token school differs from requested schoolCode (cross-tenant)", async () => {
    const res = await request(createApp())
      .get("/probe?schoolCode=SCHOOL-B")
      .set("Authorization", `Bearer ${schoolAToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("You do not have access to this school.");
  });

  it("returns 401 when token schoolId is not valid for the DB-backed session", async () => {
    const ghostToken = signToken({
      userId: previewUserId,
      schoolId: "00000000-0000-0000-0000-000000000000",
      name: "Resolve School Context Test Admin",
      email: "resolve-school-context-test@schoolconnect.test",
      role: "ADMIN_OPERATOR",
      tokenVersion: 0,
    });
    const res = await request(createApp())
      .get("/probe")
      .set("Authorization", `Bearer ${ghostToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Your session has expired. Please log in again.");
  });

  it("returns 401 in production without a token", async () => {
    process.env.NODE_ENV = "production";
    const res = await request(createApp()).get("/probe");
    expect(res.status).toBe(401);
  });

  it("resolves school from query string in test mode without a token", async () => {
    process.env.NODE_ENV = "test";
    const res = await request(createApp()).get("/probe?schoolCode=SCU-PREVIEW");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("returns 404 in test mode for an unknown schoolCode", async () => {
    process.env.NODE_ENV = "test";
    const res = await request(createApp()).get("/probe?schoolCode=NO-SUCH-SCHOOL");
    expect(res.status).toBe(404);
  });
});
