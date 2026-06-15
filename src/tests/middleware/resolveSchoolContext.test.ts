import request from "supertest";
import express from "express";
import { beforeAll, describe, expect, it } from "vitest";
import { resolveSchoolContext } from "../../server/middleware/resolveSchoolContext";
import { signToken } from "../../server/services/authService";
import { prisma } from "../../server/db/prisma";

let schoolAToken: string;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(resolveSchoolContext);
  app.get("/probe", (_req, res) => res.json({ ok: true }));
  return app;
}

beforeAll(async () => {
  const school = await prisma.school.findUnique({ where: { code: "SCU-PREVIEW" } });
  schoolAToken = signToken({
    userId: "00000000-0000-0000-0000-000000000001",
    schoolId: school?.id ?? "00000000-0000-0000-0000-000000000001",
    name: "Test Admin",
    email: "test@test.com",
    role: "ADMIN_OPERATOR",
  });
});

describe("resolveSchoolContext — cross-tenant isolation", () => {
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

  it("returns 403 when token schoolId does not exist in DB", async () => {
    const ghostToken = signToken({
      userId: "00000000-0000-0000-0000-000000000001",
      schoolId: "00000000-0000-0000-0000-000000000000",
      name: "Ghost",
      email: "ghost@test.com",
      role: "ADMIN_OPERATOR",
    });
    const res = await request(createApp())
      .get("/probe")
      .set("Authorization", `Bearer ${ghostToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("School not found for your account.");
  });

  it("returns 401 in production without a token", async () => {
    const savedEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const res = await request(createApp()).get("/probe");
    process.env.NODE_ENV = savedEnv;
    expect(res.status).toBe(401);
  });

  it("resolves school from query string in dev mode without a token", async () => {
    const res = await request(createApp()).get("/probe?schoolCode=SCU-PREVIEW");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("returns 404 in dev mode for an unknown schoolCode", async () => {
    const res = await request(createApp()).get("/probe?schoolCode=NO-SUCH-SCHOOL");
    expect(res.status).toBe(404);
  });
});
