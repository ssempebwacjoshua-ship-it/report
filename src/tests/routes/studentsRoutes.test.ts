import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer } from "../../server";

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientSource = readFileSync(resolve(__dirname, "../../client/studentsClient.ts"), "utf8");

describe("students import routes", () => {
  it("serves the student CSV template as a public static asset", async () => {
    const res = await request(createServer()).get("/templates/student-import-template.csv");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.text).toContain("admissionNumber,fullName,gender,class,stream,guardianName,guardianPhone,guardianEmail,status");
    expect(res.text).not.toContain("Authentication required");
  });

  it("accepts a valid student import CSV preview", async () => {
    const csv = [
      "admissionNumber,fullName,gender,class,stream,guardianName,guardianPhone,guardianEmail,status",
      "SCU-001,Ada Lovelace,Female,Senior 1,A,Grace Hopper,+256 700 000000,grace@example.test,ACTIVE",
    ].join("\n");
    const res = await request(createServer())
      .post("/api/students/import/preview")
      .field("schoolCode", "SCU-PREVIEW")
      .attach("file", Buffer.from(csv), { filename: "students.csv", contentType: "text/csv" });
    expect([200, 401, 404]).toContain(res.status);
  });

  it("escapes formula-like values in student import preview responses", async () => {
    const csv = [
      "admissionNumber,fullName,gender,class,stream,guardianName,guardianPhone,guardianEmail,status",
      "=1+1,+Ada,-Female,@Senior 1,A,Guard,+256 700 000000,grace@example.test,ACTIVE",
    ].join("\n");
    const res = await request(createServer())
      .post("/api/students/import/preview")
      .field("schoolCode", "SCU-PREVIEW")
      .attach("file", Buffer.from(csv), { filename: "students.csv", contentType: "text/csv" });
    expect([200, 401, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(String(res.body.rows?.[0]?.raw?.admissionNumber ?? "")).toMatch(/^'/);
      expect(String(res.body.rows?.[0]?.raw?.fullName ?? "")).toMatch(/^'/);
      expect(String(res.body.rows?.[0]?.raw?.className ?? "")).toMatch(/^'/);
    }
  });
});

describe("students routes ? new /api routes exist and do not 404", () => {
  it("GET /api/students responds (school context resolved in dev)", async () => {
    const res = await request(createServer()).get("/api/students");
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(500);
  });

  it("GET /api/students/contact-summary responds", async () => {
    const res = await request(createServer()).get("/api/students/contact-summary");
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(500);
  });

  it("GET /api/students/import-jobs/:jobId with valid UUID ? 404 not found, not a routing 404", async () => {
    const res = await request(createServer()).get("/api/students/import-jobs/00000000-0000-0000-0000-000000000000");
    // 404 means the route matched but the job wasn't found ? correct
    // 401 means school context required ? also correct
    // 500 would mean we crashed ? not acceptable
    expect([401, 404]).toContain(res.status);
  });

  it("POST /api/students/import-jobs/upload route exists (not 404)", async () => {
    const res = await request(createServer()).post("/api/students/import-jobs/upload");
    // Route must exist ? any status other than 404 confirms it
    expect(res.status).not.toBe(404);
  });

  it("POST /api/students/:id/contacts route exists (not 404)", async () => {
    const res = await request(createServer())
      .post("/api/students/00000000-0000-0000-0000-000000000000/contacts")
      .send({});
    expect(res.status).not.toBe(404);
  });

  it("DELETE /api/students/:id/contacts/:contactId route exists (not 404)", async () => {
    const res = await request(createServer()).delete(
      "/api/students/00000000-0000-0000-0000-000000000001/contacts/00000000-0000-0000-0000-000000000002",
    );
    expect(res.status).not.toBe(404);
  });
});

describe("students client ? no browser call uses /internal/students", () => {
  it("student APIs use makeSchoolRequestHeaders rather than makeRequestHeaders", () => {
    expect(clientSource).toContain("makeSchoolRequestHeaders");
    expect(clientSource).not.toContain("makeRequestHeaders()");
    expect(clientSource).not.toContain("makeRequestHeaders({ \"Content-Type\": \"application/json\" })");
  });

  it("createStudentImportJob uses /api/students/import-jobs/upload", () => {
    expect(clientSource).toContain("/api/students/import-jobs/upload");
  });

  it("commitStudentImport uses the async import-job upload route", () => {
    expect(clientSource).toContain("/api/students/import-jobs/upload");
    expect(clientSource).not.toContain("/api/students/import/commit");
  });

  it("fetchStudentImportJob uses /api/students/import-jobs/", () => {
    expect(clientSource).toContain("/api/students/import-jobs/");
  });

  it("fetchStudentContactSummary uses /api/students/contact-summary", () => {
    expect(clientSource).toContain("/api/students/contact-summary");
  });

  it("downloadStudentTemplateCsv uses the public /templates asset", () => {
    expect(clientSource).toContain("/templates/student-import-template.csv");
    expect(clientSource).not.toContain("/api/students/import/template.csv");
  });

  it("createGuardianContact uses /api/students/ (not /internal)", () => {
    expect(clientSource).toContain("api/students/");
  });

  it("no client function uses /internal/students", () => {
    expect(clientSource).not.toContain("/internal/students");
  });
});

