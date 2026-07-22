import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer } from "../../../../server";

describe("marksheetsRoutes", () => {
  it("GET /api/marksheets/students returns 400 when classId is missing", async () => {
    const res = await request(createServer()).get("/api/marksheets/students?schoolCode=SCU-PREVIEW");
    expect(res.status).toBe(400);
  });

  it("GET /api/marksheets/students returns 404 for unknown school", async () => {
    const res = await request(createServer()).get(
      "/api/marksheets/students?schoolCode=UNKNOWN-SCHOOL&classId=fake-class-id",
    );
    expect(res.status).toBe(404);
  });

  it("GET /api/marksheets/batches returns 404 for unknown school", async () => {
    const res = await request(createServer()).get("/api/marksheets/batches?schoolCode=UNKNOWN-SCHOOL");
    expect(res.status).toBe(404);
  });

  it("POST /api/marksheets/batches/:id/approve returns 404 for unknown school", async () => {
    const res = await request(createServer())
      .post("/api/marksheets/batches/fake-batch-id/approve?schoolCode=UNKNOWN-SCHOOL")
      .send({ note: "Looks good" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it("POST /api/marksheets/batches/:id/return returns 400 when note is missing", async () => {
    const res = await request(createServer())
      .post("/api/marksheets/batches/fake-batch-id/return?schoolCode=SCU-PREVIEW")
      .send({});
    expect(res.status).toBe(400);
  });

  it("POST /api/marksheets/batches/:id/return returns 404 for unknown school with note", async () => {
    const res = await request(createServer())
      .post("/api/marksheets/batches/fake-batch-id/return?schoolCode=UNKNOWN-SCHOOL")
      .send({ note: "Please correct row 3" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it("POST /api/marksheets/dry-run returns 400 when csvText is missing", async () => {
    const res = await request(createServer()).post("/api/marksheets/dry-run").send({ schoolCode: "SCU-PREVIEW" });
    expect(res.status).toBe(400);
  });

  it("POST /api/marksheets/commit returns 400 when context is missing", async () => {
    const res = await request(createServer())
      .post("/api/marksheets/commit")
      .send({ schoolCode: "SCU-PREVIEW", csvText: "header\nrow" });
    expect(res.status).toBe(400);
  });
});

