import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../server/services/authService", () => ({
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
}));

vi.mock("../../server/services/authTokenService", () => ({
  createAndSendAccountSetup: vi.fn(async () => ({ deliveryStatus: "SENT" })),
}));

import {
  changeStaffRole,
  createStaffUser,
  resetStaffPassword,
  setStaffStatus,
} from "../../server/services/staffUsersService";

const ADMIN_CTX = { schoolId: "school-1", actorId: "admin-1", role: "ADMIN_OPERATOR" };

function createDb() {
  return {
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    school: {
      findUnique: vi.fn(),
    },
    authToken: {
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe("staffUsersService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resetting a password with a weak temp password fails", async () => {
    const db = createDb();
    await expect(resetStaffPassword(ADMIN_CTX, "user-1", {
      temporaryPassword: "weakpass",
      reason: "Reset",
    }, db as any)).rejects.toMatchObject({
      message: "Temporary password must be at least 10 characters.",
      status: 400,
    });
  });

  it("creating staff sends setup invitation and keeps account pending", async () => {
    const db = createDb();
    db.user.findFirst.mockResolvedValue(null);
    db.user.create.mockResolvedValue({
      id: "user-2",
      name: "Cashier",
      email: "cashier@test.com",
      role: "CASHIER",
      isActive: false,
      mustChangePassword: true,
      lastLoginAt: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

    const result = await createStaffUser(ADMIN_CTX, {
      name: "Cashier",
      email: "cashier@test.com",
      role: "CASHIER",
    }, db as any);

    expect(result.user.mustChangePassword).toBe(true);
    expect(result.invitationDeliveryStatus).toBe("SENT");
    expect(db.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        isActive: false,
        mustChangePassword: true,
      }),
    }));
    expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        schoolId: "school-1",
        action: "STAFF_USER_CREATED",
      }),
    }));
  });

  it("disabling staff increments tokenVersion", async () => {
    const db = createDb();
    db.user.findFirst.mockResolvedValue({
      id: "user-2",
      role: "CASHIER",
    });
    db.user.update.mockResolvedValue({
      id: "user-2",
      name: "Cashier",
      email: "cashier@test.com",
      role: "CASHIER",
      isActive: false,
      mustChangePassword: false,
      lastLoginAt: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

    await setStaffStatus(ADMIN_CTX, "user-2", { isActive: false, reason: "Left" }, db as any);

    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        isActive: false,
        tokenVersion: { increment: 1 },
      }),
    }));
    expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        schoolId: "school-1",
        action: "STAFF_USER_DISABLED",
      }),
    }));
  });

  it("role change increments tokenVersion", async () => {
    const db = createDb();
    db.user.findFirst.mockResolvedValue({
      id: "user-2",
      role: "CASHIER",
    });
    db.user.update.mockResolvedValue({
      id: "user-2",
      name: "Cashier",
      email: "cashier@test.com",
      role: "SECURITY",
      isActive: true,
      mustChangePassword: false,
      lastLoginAt: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

    await changeStaffRole(ADMIN_CTX, "user-2", { role: "SECURITY", reason: "Redeployed" }, db as any);

    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        role: "SECURITY",
        tokenVersion: { increment: 1 },
      }),
    }));
    expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        schoolId: "school-1",
        action: "STAFF_ROLE_CHANGED",
      }),
    }));
  });

  it("password reset writes an audit log without storing the password", async () => {
    const db = createDb();
    db.user.findFirst.mockResolvedValue({
      id: "user-2",
      role: "CASHIER",
    });
    db.user.update.mockResolvedValue({
      id: "user-2",
      name: "Cashier",
      email: "cashier@test.com",
      role: "CASHIER",
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

    await resetStaffPassword(ADMIN_CTX, "user-2", {
      temporaryPassword: "StrongReset9",
      reason: "Reset",
    }, db as any);

    expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        schoolId: "school-1",
        action: "STAFF_PASSWORD_RESET",
      }),
    }));
    const resetAudit = db.auditLog.create.mock.calls[0][0] as { data: { details: Record<string, unknown> } };
    expect(resetAudit.data.details).not.toHaveProperty("temporaryPassword");
  });
});
