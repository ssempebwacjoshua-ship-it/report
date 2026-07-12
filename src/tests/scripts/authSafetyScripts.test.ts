import { beforeEach, describe, expect, it, vi } from "vitest";
import { runSeedAdmin } from "../../../scripts/seed-admin";
import { runCreatePlatformOwner } from "../../../scripts/create-platform-owner";
import { assertProductionCredentialRepairAllowed, classifyRuntimeEnvironment } from "../../server/security/environmentSafety";

function makeDb() {
  return {
    school: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    subject: {
      create: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  } as any;
}

const LOCAL_ENV = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test",
};

describe("auth safety scripts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("missing schoolCode is rejected", async () => {
    const db = makeDb();

    await expect(runSeedAdmin(["--email=admin@schoolconnect.test"], db, LOCAL_ENV))
      .rejects.toThrow(/--schoolCode/);
  });

  it("missing email is rejected", async () => {
    const db = makeDb();

    await expect(runSeedAdmin(["--schoolCode=SCU-PREVIEW"], db, LOCAL_ENV))
      .rejects.toThrow(/--email/);
  });

  it("seed-admin dry-run makes no writes", async () => {
    const db = makeDb();
    db.school.findUnique.mockResolvedValue(null);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runSeedAdmin(["--schoolCode=SCU-PREVIEW", "--email=admin@schoolconnect.test"], db, LOCAL_ENV);

    expect(db.school.create).not.toHaveBeenCalled();
    expect(db.user.create).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Action refused"));
  });

  it("apply is rejected when the exact school does not already exist", async () => {
    const db = makeDb();
    db.school.findUnique.mockResolvedValue(null);

    await expect(runSeedAdmin(["--schoolCode=SCU-PREVIEW", "--email=admin@schoolconnect.test", "-Apply"], db, LOCAL_ENV))
      .rejects.toThrow(/must already exist/);

    expect(db.school.create).not.toHaveBeenCalled();
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("remote database is rejected", async () => {
    const db = makeDb();

    await expect(runSeedAdmin(["--schoolCode=SCU-PREVIEW", "--email=admin@schoolconnect.test", "-Apply"], db, {
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://user:pass@db.example.com:5432/app",
    })).rejects.toThrow(/protected production database|local database host/);
  });

  it("production and unknown environments are rejected", async () => {
    const db = makeDb();
    await expect(runSeedAdmin(["--schoolCode=SCU-PREVIEW", "--email=admin@schoolconnect.test", "-Apply"], db, {
      APP_ENV: "production",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test",
    })).rejects.toThrow(/not allowed in production/);

    await expect(runSeedAdmin(["--schoolCode=SCU-PREVIEW", "--email=admin@schoolconnect.test", "-Apply"], db, {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test",
      RAILWAY_ENVIRONMENT_NAME: "production",
      NODE_ENV: "development",
    })).rejects.toThrow(/known non-production runtime|ambiguous/);
  });

  it("existing user is preserved and existing auth fields remain unchanged", async () => {
    const db = makeDb();
    db.school.findUnique.mockResolvedValue({ id: "school-1", code: "SCU-PREVIEW" });
    const existingUser = {
      id: "user-1",
      email: "admin@schoolconnect.test",
      passwordHash: "$2b$12$persistedhashvalueeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      role: "ADMIN_OPERATOR",
      isActive: false,
    };
    db.user.findFirst.mockResolvedValue(existingUser);

    await runSeedAdmin(["--schoolCode=scu-preview", "--email=ADMIN@schoolconnect.test", "-Apply"], db, LOCAL_ENV);

    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
    expect(existingUser.passwordHash).toBe("$2b$12$persistedhashvalueeeeeeeeeeeeeeeeeeeeeeeeeeeee");
    expect(existingUser.role).toBe("ADMIN_OPERATOR");
    expect(existingUser.isActive).toBe(false);
  });

  it("only the exact requested user is created and no unrelated changes occur", async () => {
    const db = makeDb();
    db.school.findUnique.mockResolvedValue({ id: "school-1", code: "SCU-PREVIEW" });
    db.user.findFirst.mockResolvedValue(null);

    await runSeedAdmin(["--schoolCode=scu-preview", "--email=ADMIN@schoolconnect.test", "-Apply"], db, LOCAL_ENV);

    expect(db.school.create).not.toHaveBeenCalled();
    expect(db.subject.create).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.user.create).toHaveBeenCalledTimes(1);
    expect(db.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        schoolId: "school-1",
        email: "admin@schoolconnect.test",
        role: "ADMIN_OPERATOR",
        isActive: true,
      }),
    }));
  });

  it("create-platform-owner dry-run makes no writes", async () => {
    const db = makeDb();
    db.school.findUnique.mockResolvedValue({ id: "school-1", code: "SCU-PREVIEW" });
    db.user.findFirst.mockResolvedValue(null);

    await runCreatePlatformOwner(["--email=owner@test.local", "--password=StrongPass123"], db, {
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test",
    });

    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("create-platform-owner preserves existing user instead of rewriting credentials", async () => {
    const db = makeDb();
    db.school.findUnique.mockResolvedValue({ id: "school-1", code: "SCU-PREVIEW" });
    db.user.findFirst.mockResolvedValue({ id: "user-1", email: "owner@test.local" });

    await runCreatePlatformOwner(["--email=owner@test.local", "--password=StrongPass123", "-Apply"], db, {
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test",
    });

    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("refuses production credential repair when flags are missing", () => {
    expect(() => assertProductionCredentialRepairAllowed({
      operationName: "repair-admin-password",
      schoolCode: "SCU-PREVIEW",
      userEmail: "admin@schoolconnect.test",
      repairReason: "investigation",
      auditActor: "platform-owner",
      env: {
        APP_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@db.example.com:5432/app",
      },
    })).toThrow(/ALLOW_DESTRUCTIVE_OPERATIONS/);
  });

  it("classifies local runtime with remote database as unknown", () => {
    const result = classifyRuntimeEnvironment({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://user:pass@db.example.com:5432/app",
    });
    expect(result.environment).toBe("unknown");
  });
});
