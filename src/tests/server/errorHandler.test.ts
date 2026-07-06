import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { errorHandler } from "../../server";

describe("safe error handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("hides raw internal error details and stack traces in production responses and logs", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = express();
    app.get("/boom", () => {
      const error = new Error("PrismaClientKnownRequestError: secret database detail");
      error.stack = "STACK_WITH_SECRET_DATABASE_URL";
      throw error;
    });
    app.use(errorHandler);

    const res = await request(app)
      .get("/boom")
      .set("x-request-id", "prod-error-test")
      .expect(500);

    expect(res.body).toMatchObject({
      ok: false,
      error: true,
      code: "SERVER_ERROR",
      message: "A server error occurred. Please try again or contact support if the problem persists.",
      requestId: "prod-error-test",
      details: [],
    });
    expect(JSON.stringify(res.body)).not.toContain("PrismaClientKnownRequestError");
    expect(JSON.stringify(res.body)).not.toContain("STACK_WITH_SECRET_DATABASE_URL");
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("PrismaClientKnownRequestError");
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("STACK_WITH_SECRET_DATABASE_URL");
  });

  it("returns the safe validation envelope for Zod errors", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const app = express();
    app.get("/validate", () => {
      z.object({ schoolCode: z.string().min(1) }).parse({});
    });
    app.use(errorHandler);

    const res = await request(app)
      .get("/validate")
      .set("x-request-id", "validation-test")
      .expect(400);

    expect(res.body).toMatchObject({
      ok: false,
      error: true,
      code: "VALIDATION_ERROR",
      message: "Please check the submitted details.",
      requestId: "validation-test",
    });
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.issues).toBeUndefined();
  });
});
