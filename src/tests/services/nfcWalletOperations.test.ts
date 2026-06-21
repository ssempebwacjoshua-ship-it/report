import { CredentialStatus, CredentialType, GateScanResult, StudentWalletStatus, WalletTransactionType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { chargeCanteen, scanGate } from "../../server/services/nfcOperationsService";

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
