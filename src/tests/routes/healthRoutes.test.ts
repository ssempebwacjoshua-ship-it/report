import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer } from "../../server";

describe("health route", () => {
  it("returns service health", async () => {
    const response = await request(createServer()).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });
});
