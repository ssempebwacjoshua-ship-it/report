import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer } from "../../server/index";

describe("app version endpoint", () => {
  it("returns an uncached build version response", async () => {
    const res = await request(createServer()).get("/api/app-version");

    expect(res.status).toBe(200);
    expect(res.body.version).toBeTruthy();
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(res.headers.pragma).toBe("no-cache");
  });
});
