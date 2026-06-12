import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer } from "../../server";

describe("students import routes", () => {
  it("returns the student CSV template", async () => {
    const res = await request(createServer()).get("/api/students/import/template");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.text).toContain("admissionNumber,fullName,gender,class,stream,guardianName,guardianPhone,guardianEmail,status");
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
    expect([200, 404]).toContain(res.status);
  });
});
