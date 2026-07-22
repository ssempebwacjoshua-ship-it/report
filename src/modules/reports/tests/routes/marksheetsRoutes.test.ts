import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createServer } from "../../../../server";
import { prisma } from "../../../../server/db/prisma";
import { hashPassword, signToken } from "../../../../server/services/authService";

let authToken = "";
const UNKNOWN_BATCH_ID = "aaaaaaaa-aaaa-4aaa-8aaa-ffffffffffff";

beforeAll(async () => {
  const school = await prisma.school.findUniqueOrThrow({
    where: { code: "SCU-PREVIEW" },
    select: { id: true },
  });
  const email = "marksheets-routes-test@schoolconnect.test";
  const passwordHash = await hashPassword("MarksheetsRoutesPass123!");
  const user = await prisma.user.upsert({
    where: {
      schoolId_email: {
        schoolId: school.id,
        email,
      },
    },
    update: {
      name: "Marksheets Routes Test Admin",
      role: "ADMIN_OPERATOR",
      isActive: true,
      passwordHash,
      tokenVersion: 0,
      mustChangePassword: false,
    },
    create: {
      schoolId: school.id,
      name: "Marksheets Routes Test Admin",
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

  authToken = signToken({
    userId: user.id,
    schoolId: user.schoolId,
    name: user.name,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });
});

function authGet(path: string) {
  return request(createServer()).get(path).set("Authorization", `Bearer ${authToken}`);
}

function authPost(path: string) {
  return request(createServer()).post(path).set("Authorization", `Bearer ${authToken}`);
}

describe("marksheetsRoutes", () => {
  it("GET /api/marksheets/students returns 401 without authentication", async () => {
    const res = await request(createServer()).get("/api/marksheets/students?classId=fake-class-id");
    expect(res.status).toBe(401);
  });

  it("GET /api/marksheets/students returns 400 when classId is missing", async () => {
    const res = await authGet("/api/marksheets/students");
    expect(res.status).toBe(400);
  });

  it("GET /api/marksheets/students returns 403 for conflicting schoolCode", async () => {
    const res = await authGet("/api/marksheets/students?schoolCode=UNKNOWN-SCHOOL&classId=fake-class-id");
    expect(res.status).toBe(403);
  });

  it("GET /api/marksheets/batches returns 401 without authentication", async () => {
    const res = await request(createServer()).get("/api/marksheets/batches");
    expect(res.status).toBe(401);
  });

  it("GET /api/marksheets/batches returns 403 for conflicting schoolCode", async () => {
    const res = await authGet("/api/marksheets/batches?schoolCode=UNKNOWN-SCHOOL");
    expect(res.status).toBe(403);
  });

  it("POST /api/marksheets/batches/:id/approve returns 401 without authentication", async () => {
    const res = await request(createServer())
      .post(`/api/marksheets/batches/${UNKNOWN_BATCH_ID}/approve`)
      .send({ note: "Looks good" });
    expect(res.status).toBe(401);
  });

  it("POST /api/marksheets/batches/:id/approve returns 404 for an unknown batch", async () => {
    const res = await authPost(`/api/marksheets/batches/${UNKNOWN_BATCH_ID}/approve`)
      .send({ note: "Looks good" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it("POST /api/marksheets/batches/:id/return returns 401 without authentication", async () => {
    const res = await request(createServer())
      .post(`/api/marksheets/batches/${UNKNOWN_BATCH_ID}/return`)
      .send({ note: "Please correct row 3" });
    expect(res.status).toBe(401);
  });

  it("POST /api/marksheets/batches/:id/return returns 400 when note is missing", async () => {
    const res = await authPost(`/api/marksheets/batches/${UNKNOWN_BATCH_ID}/return`).send({});
    expect(res.status).toBe(400);
  });

  it("POST /api/marksheets/batches/:id/return returns 404 for an unknown batch with note", async () => {
    const res = await authPost(`/api/marksheets/batches/${UNKNOWN_BATCH_ID}/return`)
      .send({ note: "Please correct row 3" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it("POST /api/marksheets/dry-run returns 401 without authentication", async () => {
    const res = await request(createServer()).post("/api/marksheets/dry-run").send({});
    expect(res.status).toBe(401);
  });

  it("POST /api/marksheets/dry-run returns 400 when csvText is missing", async () => {
    const res = await authPost("/api/marksheets/dry-run").send({});
    expect(res.status).toBe(400);
  });

  it("POST /api/marksheets/commit returns 401 without authentication", async () => {
    const res = await request(createServer())
      .post("/api/marksheets/commit")
      .send({ csvText: "header\nrow" });
    expect(res.status).toBe(401);
  });

  it("POST /api/marksheets/commit returns 400 when context is missing", async () => {
    const res = await authPost("/api/marksheets/commit").send({ csvText: "header\nrow" });
    expect(res.status).toBe(400);
  });
});
