import { describe, expect, it } from "vitest";
import { validateEnv } from "../../server/middleware/validateEnv";

// ── Non-production: only VITE_ key leaks are checked ─────────────────────────

describe("validateEnv ? non-production", () => {
  it("passes with no env vars set (dev default)", () => {
    const result = validateEnv({ NODE_ENV: "development" });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("errors when a VITE_ prefixed API key is detected (frontend exposure)", () => {
    const result = validateEnv({ NODE_ENV: "development", VITE_GEMINI_API_KEY: "leaked-key" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("VITE_GEMINI_API_KEY"))).toBe(true);
  });

  it("errors when VITE_API_SECRET is present (any case variant)", () => {
    const result = validateEnv({ NODE_ENV: "development", VITE_API_SECRET: "oops" });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("VITE_API_SECRET");
  });

  it("ignores safe VITE_ vars that are not API keys or secrets", () => {
    const result = validateEnv({ NODE_ENV: "development", VITE_APP_TITLE: "School Connect" });
    expect(result.valid).toBe(true);
  });
});

// ── Production: JWT_SECRET enforcement ───────────────────────────────────────

describe("validateEnv ? production JWT_SECRET checks", () => {
  const prodBase = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://...",
    CLIENT_ORIGIN: "https://app.example.com",
    AUTH_EMAIL_PROVIDER: "RESEND",
    RESEND_API_KEY: "resend-key",
    AUTH_EMAIL_FROM: "SSAMENJ Report Lab <support@ssamenj.online>",
    OUTREACH_EMAIL_FROM: "SSAMENJ Technologies <support@ssamenj.online>",
    OUTREACH_REPLY_TO: "support@ssamenj.online",
    APP_PUBLIC_URL: "https://ssamenj.online/report-lab",
  };

  it("errors when JWT_SECRET is missing in production", () => {
    const result = validateEnv(prodBase);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("JWT_SECRET is not set"))).toBe(true);
  });

  it("errors when JWT_SECRET is the dev placeholder in production", () => {
    const result = validateEnv({ ...prodBase, JWT_SECRET: "dev-secret-change-in-production" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("development placeholder"))).toBe(true);
  });

  it("errors when JWT_SECRET is too short in production", () => {
    const result = validateEnv({ ...prodBase, JWT_SECRET: "short" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("too short"))).toBe(true);
  });

  it("passes with a strong JWT_SECRET (32+ chars)", () => {
    const result = validateEnv({
      ...prodBase,
      JWT_SECRET: "a".repeat(32),
      APP_BASE_URL: "https://reports.example.com",
      INTERNAL_TEST_KEY: "internal-test-key",
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("PLATFORM_ADMIN_KEY"))).toBe(true); // still warns
  });
});

// ── Production: required vars ─────────────────────────────────────────────────

describe("validateEnv ? production required vars", () => {
  const prodWithJwt = {
    NODE_ENV: "production",
    JWT_SECRET: "a".repeat(32),
    AUTH_EMAIL_PROVIDER: "RESEND",
    RESEND_API_KEY: "resend-key",
    AUTH_EMAIL_FROM: "SSAMENJ Report Lab <support@ssamenj.online>",
    OUTREACH_EMAIL_FROM: "SSAMENJ Technologies <support@ssamenj.online>",
    OUTREACH_REPLY_TO: "support@ssamenj.online",
    APP_PUBLIC_URL: "https://ssamenj.online/report-lab",
  };

  it("errors when DATABASE_URL is missing in production", () => {
    const result = validateEnv({ ...prodWithJwt, CLIENT_ORIGIN: "https://app.example.com" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("DATABASE_URL"))).toBe(true);
  });

  it("errors when CLIENT_ORIGIN is missing in production", () => {
    const result = validateEnv({ ...prodWithJwt, DATABASE_URL: "postgresql://..." });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("CLIENT_ORIGIN"))).toBe(true);
  });

  it("warns (not errors) when PLATFORM_ADMIN_KEY is missing in production", () => {
    const result = validateEnv({
      ...prodWithJwt,
      DATABASE_URL: "postgresql://...",
      CLIENT_ORIGIN: "https://app.example.com",
      APP_BASE_URL: "https://reports.example.com",
      INTERNAL_TEST_KEY: "internal-test-key",
    });
    expect(result.valid).toBe(true); // warnings don't block startup
    expect(result.warnings.some((w) => w.includes("PLATFORM_ADMIN_KEY"))).toBe(true);
  });

  it("passes cleanly when all production vars are set", () => {
    const result = validateEnv({
      NODE_ENV: "production",
      JWT_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://prod-user:prod-pass@db.railway.internal:5432/school_connect_reports_lab",
      CLIENT_ORIGIN: "https://app.example.com",
      AUTH_EMAIL_PROVIDER: "RESEND",
      RESEND_API_KEY: "resend-key",
      AUTH_EMAIL_FROM: "SSAMENJ Report Lab <support@ssamenj.online>",
      OUTREACH_EMAIL_FROM: "SSAMENJ Technologies <support@ssamenj.online>",
      OUTREACH_REPLY_TO: "support@ssamenj.online",
      APP_PUBLIC_URL: "https://ssamenj.online/report-lab",
      APP_BASE_URL: "https://reports.example.com",
      PLATFORM_ADMIN_KEY: "strong-platform-key",
      INTERNAL_TEST_KEY: "strong-internal-test-key",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("errors when DATABASE_URL points at localhost in production", () => {
    const result = validateEnv({
      NODE_ENV: "production",
      JWT_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/school_connect_reports_lab_test",
      CLIENT_ORIGIN: "https://app.example.com",
      AUTH_EMAIL_PROVIDER: "RESEND",
      RESEND_API_KEY: "resend-key",
      AUTH_EMAIL_FROM: "SSAMENJ Report Lab <support@ssamenj.online>",
      OUTREACH_EMAIL_FROM: "SSAMENJ Technologies <support@ssamenj.online>",
      OUTREACH_REPLY_TO: "support@ssamenj.online",
      APP_PUBLIC_URL: "https://ssamenj.online/report-lab",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("local test database"))).toBe(true);
  });

  it("errors when CLIENT_ORIGIN points at localhost in production", () => {
    const result = validateEnv({
      NODE_ENV: "production",
      JWT_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://prod-user:prod-pass@db.railway.internal:5432/school_connect_reports_lab",
      CLIENT_ORIGIN: "http://localhost:5173",
      AUTH_EMAIL_PROVIDER: "RESEND",
      RESEND_API_KEY: "resend-key",
      AUTH_EMAIL_FROM: "SSAMENJ Report Lab <support@ssamenj.online>",
      OUTREACH_EMAIL_FROM: "SSAMENJ Technologies <support@ssamenj.online>",
      OUTREACH_REPLY_TO: "support@ssamenj.online",
      APP_PUBLIC_URL: "https://ssamenj.online/report-lab",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("CLIENT_ORIGIN points at localhost"))).toBe(true);
  });

  it("warns when no branded public URL is configured in production", () => {
    const result = validateEnv({
      NODE_ENV: "production",
      JWT_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://prod-user:prod-pass@db.railway.internal:5432/school_connect_reports_lab",
      CLIENT_ORIGIN: "https://app.example.com",
      AUTH_EMAIL_PROVIDER: "RESEND",
      RESEND_API_KEY: "resend-key",
      AUTH_EMAIL_FROM: "SSAMENJ Report Lab <support@ssamenj.online>",
      OUTREACH_EMAIL_FROM: "SSAMENJ Technologies <support@ssamenj.online>",
      OUTREACH_REPLY_TO: "support@ssamenj.online",
      APP_PUBLIC_URL: "https://ssamenj.online/report-lab",
      PLATFORM_ADMIN_KEY: "strong-platform-key",
      INTERNAL_TEST_KEY: "strong-internal-test-key",
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("APP_BASE_URL / PUBLIC_APP_URL"))).toBe(true);
  });

  it("warns when INTERNAL_TEST_KEY is missing in production", () => {
    const result = validateEnv({
      NODE_ENV: "production",
      JWT_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://prod-user:prod-pass@db.railway.internal:5432/school_connect_reports_lab",
      CLIENT_ORIGIN: "https://app.example.com",
      AUTH_EMAIL_PROVIDER: "RESEND",
      RESEND_API_KEY: "resend-key",
      AUTH_EMAIL_FROM: "SSAMENJ Report Lab <support@ssamenj.online>",
      OUTREACH_EMAIL_FROM: "SSAMENJ Technologies <support@ssamenj.online>",
      OUTREACH_REPLY_TO: "support@ssamenj.online",
      APP_PUBLIC_URL: "https://ssamenj.online/report-lab",
      APP_BASE_URL: "https://reports.example.com",
      PLATFORM_ADMIN_KEY: "strong-platform-key",
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("INTERNAL_TEST_KEY"))).toBe(true);
  });

  it("errors when auth email provider is misconfigured in production", () => {
    const result = validateEnv({
      NODE_ENV: "production",
      JWT_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://prod-user:prod-pass@db.railway.internal:5432/school_connect_reports_lab",
      CLIENT_ORIGIN: "https://app.example.com",
      AUTH_EMAIL_PROVIDER: "SENDGRID",
      RESEND_API_KEY: "resend-key",
      AUTH_EMAIL_FROM: "SSAMENJ Report Lab <support@ssamenj.online>",
      OUTREACH_EMAIL_FROM: "SSAMENJ Technologies <support@ssamenj.online>",
      OUTREACH_REPLY_TO: "support@ssamenj.online",
      APP_PUBLIC_URL: "https://ssamenj.online/report-lab",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("AUTH_EMAIL_PROVIDER must be set to RESEND"))).toBe(true);
  });

  it("errors when auth email configuration is incomplete in production", () => {
    const result = validateEnv({
      NODE_ENV: "production",
      JWT_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://prod-user:prod-pass@db.railway.internal:5432/school_connect_reports_lab",
      CLIENT_ORIGIN: "https://app.example.com",
      AUTH_EMAIL_PROVIDER: "RESEND",
      EMAIL_FROM: "SSAMENJ <no-reply@example.com>",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("RESEND_API_KEY is not set"))).toBe(true);
    expect(result.errors.some((e) => e.includes("AUTH_EMAIL_FROM is not set"))).toBe(true);
  });

  it("errors when outreach email configuration is incomplete in production", () => {
    const result = validateEnv({
      NODE_ENV: "production",
      JWT_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://prod-user:prod-pass@db.railway.internal:5432/school_connect_reports_lab",
      CLIENT_ORIGIN: "https://app.example.com",
      AUTH_EMAIL_PROVIDER: "RESEND",
      RESEND_API_KEY: "resend-key",
      AUTH_EMAIL_FROM: "SSAMENJ Report Lab <support@ssamenj.online>",
      APP_PUBLIC_URL: "https://ssamenj.online/report-lab",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("OUTREACH_EMAIL_FROM is not set"))).toBe(true);
    expect(result.errors.some((e) => e.includes("OUTREACH_REPLY_TO is not set"))).toBe(true);
  });

  it("errors when outreach email sender or reply-to are not official company values", () => {
    const result = validateEnv({
      NODE_ENV: "production",
      JWT_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://prod-user:prod-pass@db.railway.internal:5432/school_connect_reports_lab",
      CLIENT_ORIGIN: "https://app.example.com",
      AUTH_EMAIL_PROVIDER: "RESEND",
      RESEND_API_KEY: "resend-key",
      AUTH_EMAIL_FROM: "SSAMENJ Report Lab <support@ssamenj.online>",
      OUTREACH_EMAIL_FROM: "Joshua <joshua@gmail.com>",
      OUTREACH_REPLY_TO: "hello@example.com",
      APP_PUBLIC_URL: "https://ssamenj.online/report-lab",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("OUTREACH_EMAIL_FROM must use the official company sender address"))).toBe(true);
    expect(result.errors.some((e) => e.includes("OUTREACH_REPLY_TO must be support@ssamenj.online"))).toBe(true);
  });

  it("errors when auth email sender format is invalid in production", () => {
    const result = validateEnv({
      NODE_ENV: "production",
      JWT_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://prod-user:prod-pass@db.railway.internal:5432/school_connect_reports_lab",
      CLIENT_ORIGIN: "https://app.example.com",
      AUTH_EMAIL_PROVIDER: "RESEND",
      RESEND_API_KEY: "resend-key",
      AUTH_EMAIL_FROM: "SSAMENJ Report Lab support@ssamenj.online",
      APP_PUBLIC_URL: "https://ssamenj.online/report-lab",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("AUTH_EMAIL_FROM is invalid"))).toBe(true);
  });
});
