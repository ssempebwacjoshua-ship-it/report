import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../server/services/authService", () => ({
  hashPassword: vi.fn(async (value: string) => `hashed:${value}`),
  normalizeLoginEmail: vi.fn((value: string) => value.trim().toLowerCase()),
  normalizeSchoolCode: vi.fn((value: string) => value.trim().toUpperCase()),
  verifyPassword: vi.fn(async (plain: string, hash: string) => hash === `hashed:${plain}`),
}));

vi.mock("../../server/services/emailService", () => ({
  sendAuthEmail: vi.fn(async () => ({ ok: true, provider: "RESEND", messageId: "msg-1" })),
}));

import { createAndSendAccountSetup, requestPasswordReset, resetPasswordWithOtp } from "../../server/services/authTokenService";

function createDb() {
  return {
    school: {
      findUnique: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    authToken: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback({
      authToken: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      user: {
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    })),
  };
}

describe("authTokenService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_PUBLIC_URL = "https://ssamenj.online/report-lab";
  });

  it("returns a generic result for unknown password-reset users", async () => {
    const db = createDb();
    db.school.findUnique.mockResolvedValue({ id: "school-1", code: "SSAMENJ", isActive: true });
    db.user.findFirst.mockResolvedValue(null);

    const result = await requestPasswordReset({ schoolCode: "ssamenj", email: "missing@example.com" }, db as any);

    expect(result).toEqual({ ok: true, cooldownSeconds: 0 });
    expect(db.authToken.create).not.toHaveBeenCalled();
  });

  it("stores only a hashed OTP and never returns the OTP", async () => {
    const db = createDb();
    db.school.findUnique.mockResolvedValue({ id: "school-1", code: "SSAMENJ", isActive: true, name: "SSAMENJ" });
    db.user.findFirst.mockResolvedValue({ id: "user-1", schoolId: "school-1", name: "Amina", email: "amina@example.com", isActive: true });
    db.authToken.findFirst.mockResolvedValue(null);
    db.authToken.create.mockResolvedValue({ id: "token-1" });

    const result = await requestPasswordReset({ schoolCode: "SSAMENJ", email: "amina@example.com" }, db as any);

    expect(result).toEqual({ ok: true, cooldownSeconds: 60 });
    expect(db.authToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tokenHash: expect.stringMatching(/^hashed:\d{6}$/),
      }),
    }));
    expect(JSON.stringify(result)).not.toContain("token");
    expect(JSON.stringify(result)).not.toContain("otp");
  });

  it("resets the password with a valid OTP and revokes older active resets", async () => {
    const db = createDb();
    db.school.findUnique.mockResolvedValue({ id: "school-1", code: "SSAMENJ", isActive: true });
    db.user.findFirst.mockResolvedValue({ id: "user-1", schoolId: "school-1", name: "Amina", email: "amina@example.com", isActive: true });
    db.$transaction = vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback({
      authToken: {
        findFirst: vi.fn(async () => ({
          id: "token-1",
          schoolId: "school-1",
          userId: "user-1",
          tokenHash: "hashed:123456",
          attemptCount: 0,
          expiresAt: new Date(Date.now() + 5 * 60_000),
        })),
        update: vi.fn(async () => ({})),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      user: {
        update: vi.fn(async () => ({ id: "user-1", name: "Amina", email: "amina@example.com" })),
      },
      auditLog: {
        create: vi.fn(async () => ({})),
      },
    }));

    await expect(resetPasswordWithOtp({
      schoolCode: "SSAMENJ",
      email: "amina@example.com",
      otp: "123456",
      password: "NewPassword9",
    }, db as any)).resolves.toEqual({ ok: true });
  });

  it("increments attempts for wrong OTPs and locks after five", async () => {
    const db = createDb();
    db.school.findUnique.mockResolvedValue({ id: "school-1", code: "SSAMENJ", isActive: true });
    db.user.findFirst.mockResolvedValue({ id: "user-1", schoolId: "school-1", name: "Amina", email: "amina@example.com", isActive: true });
    const authTokenUpdate = vi.fn(async () => ({}));
    db.$transaction = vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback({
      authToken: {
        findFirst: vi.fn(async () => ({
          id: "token-1",
          schoolId: "school-1",
          userId: "user-1",
          tokenHash: "hashed:123456",
          attemptCount: 4,
          expiresAt: new Date(Date.now() + 5 * 60_000),
        })),
        update: authTokenUpdate,
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
      user: {
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    }));

    await expect(resetPasswordWithOtp({
      schoolCode: "SSAMENJ",
      email: "amina@example.com",
      otp: "000000",
      password: "NewPassword9",
    }, db as any)).rejects.toMatchObject({ code: "OTP_LOCKED" });

    expect(authTokenUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "token-1" },
      data: expect.objectContaining({ attemptCount: 5, revokedAt: expect.any(Date) }),
    }));
  });

  it("uses the branded report-lab setup path in invitation emails", async () => {
    const db = createDb();
    db.user.findFirst.mockResolvedValue({ id: "user-1", schoolId: "school-1", name: "Amina", email: "amina@example.com" });
    db.school.findUnique.mockResolvedValue({ id: "school-1", name: "SSAMENJ School" });
    db.authToken.create.mockResolvedValue({ id: "token-1" });
    db.authToken.update.mockResolvedValue({});

    await createAndSendAccountSetup({
      userId: "user-1",
      schoolId: "school-1",
      inviterName: "your school administrator",
    }, db as any);

    expect(db.authToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tokenHash: expect.any(String),
      }),
    }));
  });
});
