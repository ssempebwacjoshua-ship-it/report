import { CredentialStatus, CredentialType, GateScanResult, StudentWalletStatus, WalletTransactionType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { chargeCanteen, resolveWalletStudent, scanGate, topUpWallet } from "../../server/services/nfcOperationsService";

function student(id = "student-a", schoolId = "school-a", active = true) {
  return {
    id,
    schoolId,
    admissionNumber: id === "student-a" ? "A-001" : "B-001",
    firstName: id === "student-a" ? "Ada" : "Grace",
    lastName: id === "student-a" ? "Lovelace" : "Hopper",
    isActive: active,
    enrollments: [{ class: { id: "class-a", name: "Senior 1" }, stream: { id: "stream-a", name: "A" } }],
  };
}

function createDb(options: { walletBalance?: number; walletStatus?: StudentWalletStatus; credentialStatus?: CredentialStatus; studentActive?: boolean } = {}) {
  const students = [student("student-a", "school-a", options.studentActive ?? true), student("student-b", "school-b")];
  const credentials = [
    {
      id: "credential-a",
      schoolId: "school-a",
      studentId: "student-a",
      type: CredentialType.NFC_WRISTBAND,
      credentialUID: "UID-A",
      scanToken: "token-a",
      status: options.credentialStatus ?? CredentialStatus.ACTIVE,
      issuedAt: new Date("2026-06-21T08:00:00.000Z"),
      student: students[0],
    },
    {
      id: "credential-b",
      schoolId: "school-b",
      studentId: "student-b",
      type: CredentialType.NFC_WRISTBAND,
      credentialUID: "UID-B",
      scanToken: "token-b",
      status: CredentialStatus.ACTIVE,
      issuedAt: new Date("2026-06-21T08:00:00.000Z"),
      student: students[1],
    },
  ];
  const wallets = [
    {
      id: "wallet-a",
      schoolId: "school-a",
      studentId: "student-a",
      balanceCents: options.walletBalance ?? 500000,
      status: options.walletStatus ?? StudentWalletStatus.ACTIVE,
      frozenReason: options.walletStatus === StudentWalletStatus.FROZEN ? "Disputed" : null,
    },
  ];
  const transactions: Array<{
    id: string;
    schoolId: string;
    studentId: string;
    walletId: string;
    credentialId: string | null;
    cashierUserId: string | null;
    type: WalletTransactionType;
    amountCents: number;
    paymentMethod: string | null;
    reference: string | null;
    description: string | null;
    idempotencyKey: string | null;
    createdAt: Date;
  }> = [];
  const gateScans: unknown[] = [];

  const db = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
    studentCredential: {
      findFirst: async ({ where }: { where: { schoolId: string; OR: Array<{ scanToken?: string; credentialUID?: string }> } }) =>
        credentials.find((credential) =>
          credential.schoolId === where.schoolId
          && where.OR.some((condition) => condition.scanToken === credential.scanToken || condition.credentialUID === credential.credentialUID),
        ) ?? null,
    },
    studentWallet: {
      findFirst: async ({ where }: { where: { studentId: string; schoolId: string } }) =>
        wallets.find((item) => item.studentId === where.studentId && item.schoolId === where.schoolId) ?? null,
      upsert: async ({ where, create }: { where: { studentId: string }; create: { schoolId: string; studentId: string; balanceCents: number } }) => {
        let wallet = wallets.find((item) => item.studentId === where.studentId);
        if (!wallet) {
          wallet = { id: `wallet-${wallets.length + 1}`, schoolId: create.schoolId, studentId: create.studentId, balanceCents: create.balanceCents, status: StudentWalletStatus.ACTIVE, frozenReason: null };
          wallets.push(wallet);
        }
        return wallet;
      },
      update: async ({ where, data }: { where: { id: string }; data: { balanceCents: number } }) => {
        const wallet = wallets.find((item) => item.id === where.id);
        if (!wallet) throw new Error("wallet missing");
        wallet.balanceCents = data.balanceCents;
        return wallet;
      },
      findMany: async () => wallets,
    },
    studentWalletTransaction: {
      findMany: async () => transactions,
      findUnique: async ({ where }: { where: { schoolId_idempotencyKey: { schoolId: string; idempotencyKey: string } } }) =>
        transactions.find((transaction) => transaction.schoolId === where.schoolId_idempotencyKey.schoolId && transaction.idempotencyKey === where.schoolId_idempotencyKey.idempotencyKey) ?? null,
      create: async ({ data }: { data: Omit<(typeof transactions)[number], "id" | "createdAt"> }) => {
        const transaction = { ...data, id: `tx-${transactions.length + 1}`, createdAt: new Date("2026-06-21T09:00:00.000Z") };
        transactions.push(transaction);
        return transaction;
      },
    },
    student: {
      findFirst: async ({ where }: { where: { id?: string; admissionNumber?: string; schoolId: string; isActive?: boolean } }) =>
        students.find((s) =>
          s.schoolId === where.schoolId
          && (where.isActive === undefined || s.isActive === where.isActive)
          && (where.id ? s.id === where.id : where.admissionNumber ? s.admissionNumber === where.admissionNumber : false),
        ) ?? null,
    },
    nfcGateScan: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const scan = { ...data, id: `gate-${gateScans.length + 1}`, scannedAt: new Date("2026-06-21T09:00:00.000Z") };
        gateScans.push(scan);
        return scan;
      },
    },
    studentAttendanceEvent: {
      findFirst: async () => null,
    },
    auditLog: {
      create: vi.fn(async () => ({})),
    },
  };

  return { db: db as never, wallets, transactions, gateScans };
}

describe("NFC canteen and gate operations", () => {
  it("charges a student wallet successfully", async () => {
    const { db, wallets, transactions } = createDb();
    const result = await chargeCanteen({ schoolId: "school-a", actorId: "cashier-a", role: "CASHIER" }, { tokenOrUid: "/nfc/t/token-a", amountCents: 150000, description: "Lunch" }, db);

    expect(result.ok).toBe(true);
    expect(wallets[0]?.balanceCents).toBe(350000);
    expect(transactions).toHaveLength(1);
    expect(result.student?.admissionNumber).toBe("A-001");
  });

  it("blocks canteen charge for insufficient balance", async () => {
    const { db } = createDb({ walletBalance: 10000 });
    const result = await chargeCanteen({ schoolId: "school-a", actorId: "cashier-a", role: "CASHIER" }, { tokenOrUid: "token-a", amountCents: 50000 }, db);

    expect(result).toMatchObject({ ok: false, reason: "insufficient balance" });
  });

  it("blocks canteen charge for frozen wallet", async () => {
    const { db } = createDb({ walletStatus: StudentWalletStatus.FROZEN });
    const result = await chargeCanteen({ schoolId: "school-a", actorId: "cashier-a", role: "CASHIER" }, { tokenOrUid: "token-a", amountCents: 50000 }, db);

    expect(result).toMatchObject({ ok: false, reason: "wallet frozen" });
  });

  it("blocks canteen charge for deactivated credential", async () => {
    const { db } = createDb({ credentialStatus: CredentialStatus.DEACTIVATED });
    const result = await chargeCanteen({ schoolId: "school-a", actorId: "cashier-a", role: "CASHIER" }, { tokenOrUid: "token-a", amountCents: 50000 }, db);

    expect(result).toMatchObject({ ok: false, reason: "lost or deactivated wristband" });
  });

  it("allows a valid gate scan and blocks wrong-school tokens", async () => {
    const { db } = createDb();
    const allowed = await scanGate({ schoolId: "school-a", actorId: "security-a", role: "SECURITY" }, { tokenOrUid: "token-a" }, db);
    const wrongSchool = await scanGate({ schoolId: "school-a", actorId: "security-a", role: "SECURITY" }, { tokenOrUid: "token-b" }, db);

    expect(allowed.result).toBe(GateScanResult.ALLOWED);
    expect(wrongSchool).toMatchObject({ result: GateScanResult.BLOCKED, reason: "unknown token" });
  });

  it("does not let neutral tokens bypass role permissions", async () => {
    const { db } = createDb();
    await expect(scanGate({ schoolId: "school-a", actorId: "cashier-a", role: "CASHIER" }, { tokenOrUid: "token-a" }, db)).rejects.toMatchObject({ status: 403 });
    await expect(chargeCanteen({ schoolId: "school-a", actorId: "security-a", role: "SECURITY" }, { tokenOrUid: "token-a", amountCents: 1000 }, db)).rejects.toMatchObject({ status: 403 });
  });
});

// ─── Top-up tests ─────────────────────────────────────────────────────────────

const TOP_UP_CTX = { schoolId: "school-a", actorId: "cashier-a", role: "CASHIER" as const };

describe("topUpWallet — service unit tests", () => {
  it("tops up by studentId and increases balance", async () => {
    const { db, wallets, transactions } = createDb({ walletBalance: 100000 });
    const result = await topUpWallet(TOP_UP_CTX, { studentId: "student-a", amountUgx: 5000, paymentMethod: "CASH" }, db);

    expect(result.ok).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(wallets[0]?.balanceCents).toBe(100000 + 5000 * 100);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.type).toBe(WalletTransactionType.TOP_UP);
    expect(transactions[0]?.amountCents).toBe(5000 * 100);
    expect(transactions[0]?.paymentMethod).toBe("CASH");
    expect(result.walletBefore?.balanceCents).toBe(100000);
    expect(result.wallet?.balanceCents).toBe(100000 + 5000 * 100);
  });

  it("tops up by admissionNumber", async () => {
    const { db, wallets } = createDb({ walletBalance: 0 });
    const result = await topUpWallet(TOP_UP_CTX, { admissionNumber: "A-001", amountUgx: 2000, paymentMethod: "MOBILE_MONEY" }, db);

    expect(result.ok).toBe(true);
    expect(wallets[0]?.balanceCents).toBe(2000 * 100);
    expect(result.student?.admissionNumber).toBe("A-001");
  });

  it("tops up by tokenOrUid (NFC wristband)", async () => {
    const { db, wallets } = createDb();
    const result = await topUpWallet(TOP_UP_CTX, { tokenOrUid: "token-a", amountUgx: 1000, paymentMethod: "CASH" }, db);

    expect(result.ok).toBe(true);
    expect(wallets[0]?.balanceCents).toBe(500000 + 1000 * 100);
  });

  it("creates a wallet if one does not exist yet", async () => {
    const { db, wallets } = createDb();
    // Student B has no wallet initially; use a minimal subset
    const result = await topUpWallet(
      { schoolId: "school-b", actorId: "cashier-b", role: "CASHIER" },
      { studentId: "student-b", amountUgx: 3000, paymentMethod: "CASH" },
      db,
    );

    expect(result.ok).toBe(true);
    // A new wallet should have been created for school-b / student-b
    const newWallet = wallets.find((w) => w.studentId === "student-b");
    expect(newWallet).toBeDefined();
    expect(newWallet?.balanceCents).toBe(3000 * 100);
  });

  it("creates a TOP_UP transaction with paymentMethod and reference", async () => {
    const { db, transactions } = createDb();
    await topUpWallet(TOP_UP_CTX, {
      studentId: "student-a",
      amountUgx: 10000,
      paymentMethod: "MOBILE_MONEY",
      reference: "MTN-123456",
      notes: "Parent deposit",
    }, db);

    expect(transactions[0]?.paymentMethod).toBe("MOBILE_MONEY");
    expect(transactions[0]?.reference).toBe("MTN-123456");
    expect(transactions[0]?.description).toBe("Parent deposit");
  });

  it("rejects inactive student by studentId", async () => {
    const { db } = createDb({ studentActive: false });
    await expect(topUpWallet(TOP_UP_CTX, { studentId: "student-a", amountUgx: 1000, paymentMethod: "CASH" }, db))
      .rejects.toMatchObject({ status: 404 });
  });

  it("rejects inactive student via deactivated NFC wristband", async () => {
    const { db } = createDb({ credentialStatus: CredentialStatus.DEACTIVATED });
    await expect(topUpWallet(TOP_UP_CTX, { tokenOrUid: "token-a", amountUgx: 1000, paymentMethod: "CASH" }, db))
      .rejects.toMatchObject({ status: 400 });
  });

  it("rejects zero or negative amount", async () => {
    const { db } = createDb();
    await expect(topUpWallet(TOP_UP_CTX, { studentId: "student-a", amountUgx: 0, paymentMethod: "CASH" }, db))
      .rejects.toMatchObject({ status: 400 });
    await expect(topUpWallet(TOP_UP_CTX, { studentId: "student-a", amountUgx: -500, paymentMethod: "CASH" }, db))
      .rejects.toMatchObject({ status: 400 });
  });

  it("returns duplicate:true on idempotencyKey collision", async () => {
    const { db } = createDb();
    const ikey = "test-ikey-001";
    await topUpWallet(TOP_UP_CTX, { studentId: "student-a", amountUgx: 5000, paymentMethod: "CASH", idempotencyKey: ikey }, db);
    const second = await topUpWallet(TOP_UP_CTX, { studentId: "student-a", amountUgx: 5000, paymentMethod: "CASH", idempotencyKey: ikey }, db);

    expect(second.ok).toBe(true);
    expect(second.duplicate).toBe(true);
    // Balance should only have increased once
    expect(second.wallet?.balanceCents).toBe(500000 + 5000 * 100);
  });

  it("blocks TEACHER and SECURITY roles", async () => {
    const { db } = createDb();
    await expect(topUpWallet({ schoolId: "school-a", actorId: "t", role: "TEACHER" }, { studentId: "student-a", amountUgx: 1000, paymentMethod: "CASH" }, db))
      .rejects.toMatchObject({ status: 403 });
    await expect(topUpWallet({ schoolId: "school-a", actorId: "s", role: "SECURITY" }, { studentId: "student-a", amountUgx: 1000, paymentMethod: "CASH" }, db))
      .rejects.toMatchObject({ status: 403 });
  });

  it("tenant isolation: unknown admissionNumber returns 404", async () => {
    const { db } = createDb();
    await expect(topUpWallet(TOP_UP_CTX, { admissionNumber: "BOGUS-999", amountUgx: 1000, paymentMethod: "CASH" }, db))
      .rejects.toMatchObject({ status: 404 });
  });

  it("creates an audit log entry", async () => {
    const { db } = createDb();
    await topUpWallet(TOP_UP_CTX, { studentId: "student-a", amountUgx: 5000, paymentMethod: "CASH" }, db);
    expect((db as { auditLog: { create: ReturnType<typeof vi.fn> } }).auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "student_wallet.top_up" }),
      }),
    );
  });
});

describe("resolveWalletStudent — service unit tests", () => {
  it("resolves by studentId and returns wallet balance", async () => {
    const { db } = createDb({ walletBalance: 250000 });
    const result = await resolveWalletStudent(TOP_UP_CTX, { studentId: "student-a" }, db);

    expect(result.student.admissionNumber).toBe("A-001");
    expect(result.wallet?.balanceCents).toBe(250000);
  });

  it("resolves by admissionNumber", async () => {
    const { db } = createDb();
    const result = await resolveWalletStudent(TOP_UP_CTX, { admissionNumber: "A-001" }, db);

    expect(result.student.id).toBe("student-a");
  });

  it("resolves by tokenOrUid (NFC scan)", async () => {
    const { db } = createDb();
    const result = await resolveWalletStudent(TOP_UP_CTX, { tokenOrUid: "token-a" }, db);

    expect(result.student.name).toBe("Ada Lovelace");
    expect(result.credentialId).toBe("credential-a");
  });

  it("returns null wallet when student has no wallet yet", async () => {
    const { db } = createDb();
    const result = await resolveWalletStudent(
      { schoolId: "school-b", actorId: "cashier-b", role: "CASHIER" },
      { studentId: "student-b" },
      db,
    );

    expect(result.wallet).toBeNull();
  });

  it("blocks unauthorised roles", async () => {
    const { db } = createDb();
    await expect(resolveWalletStudent({ schoolId: "school-a", actorId: "t", role: "TEACHER" }, { studentId: "student-a" }, db))
      .rejects.toMatchObject({ status: 403 });
  });
});
