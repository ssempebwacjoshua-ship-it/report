import { describe, expect, it, vi } from "vitest";
import { approveCanteenReconciliation, closeCanteenReconciliation, getCanteenReconciliation } from "../../server/services/nfcCanteenReconciliationService";

const ADMIN_CTX = { schoolId: "school-a", actorId: "admin-a", role: "ADMIN_OPERATOR" as const };
const CASHIER_CTX = { schoolId: "school-a", actorId: "cashier-a", role: "CASHIER" as const };

function student(id = "student-a") {
  return {
    id,
    admissionNumber: id === "student-a" ? "A-001" : "B-001",
    firstName: id === "student-a" ? "Ada" : "Grace",
    lastName: id === "student-a" ? "Lovelace" : "Hopper",
    enrollments: [{ class: { name: "Senior 1" }, stream: { name: "A" } }],
  };
}

function makeDb() {
  const students = [student("student-a")];
  const users = [
    { id: "cashier-a", name: "Cashier One", role: "CASHIER" },
    { id: "admin-a", name: "Admin One", role: "ADMIN_OPERATOR" },
  ];
  const wallets = [{ id: "wallet-a", schoolId: "school-a", studentId: "student-a", balanceCents: 140000 }];
  const transactions: Array<any> = [
    {
      id: "tx-topup",
      schoolId: "school-a",
      studentId: "student-a",
      walletId: "wallet-a",
      type: "TOP_UP",
      amountCents: 50000,
      balanceAfterCents: 150000,
      paymentMethod: "CASH",
      reference: "RCPT-1",
      description: null,
      reversalOfId: null,
      cashierUserId: "cashier-a",
      createdAt: new Date("2026-06-24T09:00:00.000Z"),
      student: students[0],
      cashier: users[0],
    },
    {
      id: "tx-charge",
      schoolId: "school-a",
      studentId: "student-a",
      walletId: "wallet-a",
      type: "CHARGE",
      amountCents: -20000,
      balanceAfterCents: 130000,
      paymentMethod: null,
      reference: null,
      description: "Lunch",
      reversalOfId: null,
      cashierUserId: "cashier-a",
      createdAt: new Date("2026-06-24T11:00:00.000Z"),
      student: students[0],
      cashier: users[0],
    },
    {
      id: "tx-reversal",
      schoolId: "school-a",
      studentId: "student-a",
      walletId: "wallet-a",
      type: "REVERSAL",
      amountCents: 20000,
      balanceAfterCents: 150000,
      paymentMethod: null,
      reference: null,
      description: "Wrong charge",
      reversalOfId: "tx-charge",
      cashierUserId: "admin-a",
      createdAt: new Date("2026-06-24T12:00:00.000Z"),
      student: students[0],
      cashier: users[1],
    },
    {
      id: "tx-adjustment",
      schoolId: "school-a",
      studentId: "student-a",
      walletId: "wallet-a",
      type: "ADJUSTMENT",
      amountCents: -10000,
      balanceAfterCents: 140000,
      paymentMethod: null,
      reference: null,
      description: "Correction",
      reversalOfId: null,
      cashierUserId: "admin-a",
      createdAt: new Date("2026-06-24T13:00:00.000Z"),
      student: students[0],
      cashier: users[1],
    },
  ];
  const reconciliations: Array<any> = [];
  const auditLog = { create: vi.fn(async () => ({})) };

  const db = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
    studentWalletTransaction: {
      findMany: async ({ where }: { where?: { schoolId?: string; createdAt?: { gte: Date; lt: Date }; cashierUserId?: string } } = {}) =>
        transactions.filter((tx) => {
          if (where?.schoolId && tx.schoolId !== where.schoolId) return false;
          if (where?.cashierUserId && tx.cashierUserId !== where.cashierUserId) return false;
          if (where?.createdAt) {
            if (tx.createdAt < where.createdAt.gte || tx.createdAt >= where.createdAt.lt) return false;
          }
          return true;
        }),
      findFirst: async ({ where }: { where: { id?: string; schoolId?: string } }) =>
        transactions.find((tx) => (!where.id || tx.id === where.id) && (!where.schoolId || tx.schoolId === where.schoolId)) ?? null,
    },
    studentWallet: {
      findMany: async () => wallets,
    },
    user: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) => users.filter((user) => where.id.in.includes(user.id)),
    },
    canteenReconciliation: {
      findFirst: async ({ where }: { where: { id?: string; schoolId?: string; date?: Date; cashierUserId?: string; shiftName?: string } }) =>
        reconciliations.find((record) => {
          if (where.id && record.id !== where.id) return false;
          if (where.schoolId && record.schoolId !== where.schoolId) return false;
          if (where.cashierUserId && record.cashierUserId !== where.cashierUserId) return false;
          if (where.shiftName && record.shiftName !== where.shiftName) return false;
          return true;
        }) ?? null,
      create: async ({ data }: { data: any }) => {
        const record = { ...data, id: `rec-${reconciliations.length + 1}`, createdAt: new Date("2026-06-24T14:00:00.000Z"), updatedAt: new Date("2026-06-24T14:00:00.000Z") };
        reconciliations.push(record);
        return record;
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const record = reconciliations.find((item) => item.id === where.id);
        if (!record) throw new Error("record missing");
        Object.assign(record, data, { updatedAt: new Date("2026-06-24T15:00:00.000Z") });
        return record;
      },
    },
    auditLog,
  };

  return { db: db as never, reconciliations, auditLog };
}

describe("NFC canteen reconciliation", () => {
  it("counts top-ups as collections", async () => {
    const { db } = makeDb();
    const result = await getCanteenReconciliation(ADMIN_CTX, { date: "2026-06-24" }, db);

    expect(result.summary.totalTopUpsCents).toBe(50000);
    expect(result.summary.totalCashTopUpsCents).toBe(50000);
    expect(result.summary.totalMobileMoneyTopUpsCents).toBe(0);
    expect(result.summary.declaredCashCents).toBe(50000);
  });

  it("counts canteen charges and reduces net payable by reversals", async () => {
    const { db } = makeDb();
    const result = await getCanteenReconciliation(ADMIN_CTX, { date: "2026-06-24" }, db);

    expect(result.summary.totalCanteenChargesCents).toBe(20000);
    expect(result.summary.totalReversalsCents).toBe(20000);
    expect(result.summary.netCanteenPayableCents).toBe(0);
  });

  it("calculates closing balance from wallet movement", async () => {
    const { db } = makeDb();
    const result = await getCanteenReconciliation(ADMIN_CTX, { date: "2026-06-24" }, db);

    expect(result.summary.openingWalletBalanceCents).toBe(100000);
    expect(result.summary.closingWalletBalanceCents).toBe(140000);
    expect(result.summary.netWalletMovementCents).toBe(40000);
  });

  it("requires notes when variance is not zero", async () => {
    const { db } = makeDb();
    await expect(closeCanteenReconciliation(ADMIN_CTX, {
      date: "2026-06-24",
      declaredCashUgx: 10,
      declaredMobileMoneyUgx: 0,
      notes: "",
    }, db)).rejects.toMatchObject({ status: 400 });
  });

  it("blocks CASHIER from approving reconciliations", async () => {
    const { db, reconciliations } = makeDb();
    reconciliations.push({
      id: "rec-1",
      schoolId: "school-a",
      date: new Date("2026-06-23T20:00:00.000Z"),
      shiftName: null,
      cashierUserId: null,
      canteenOperatorUserId: null,
      openingWalletBalanceCents: 100000,
      totalTopUpsCents: 50000,
      totalCashTopUpsCents: 50000,
      totalMobileMoneyTopUpsCents: 0,
      totalParentDepositTopUpsCents: 0,
      totalAdjustmentTopUpsCents: 0,
      totalCanteenChargesCents: 20000,
      totalReversalsCents: 20000,
      netCanteenPayableCents: 0,
      closingWalletBalanceCents: 140000,
      declaredCashCents: 50000,
      declaredMobileMoneyCents: 0,
      varianceCents: 0,
      status: "SUBMITTED",
      notes: null,
      submittedByUserId: "cashier-a",
      approvedByUserId: null,
      submittedAt: new Date(),
      approvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(approveCanteenReconciliation(CASHIER_CTX, "rec-1", db)).rejects.toMatchObject({ status: 403 });
  });

  it("allows ADMIN_OPERATOR to approve reconciliations", async () => {
    const { db, reconciliations } = makeDb();
    reconciliations.push({
      id: "rec-1",
      schoolId: "school-a",
      date: new Date("2026-06-24T00:00:00.000Z"),
      shiftName: null,
      cashierUserId: null,
      canteenOperatorUserId: null,
      openingWalletBalanceCents: 100000,
      totalTopUpsCents: 50000,
      totalCashTopUpsCents: 50000,
      totalMobileMoneyTopUpsCents: 0,
      totalParentDepositTopUpsCents: 0,
      totalAdjustmentTopUpsCents: 0,
      totalCanteenChargesCents: 20000,
      totalReversalsCents: 20000,
      netCanteenPayableCents: 0,
      closingWalletBalanceCents: 140000,
      declaredCashCents: 50000,
      declaredMobileMoneyCents: 0,
      varianceCents: 0,
      status: "SUBMITTED",
      notes: null,
      submittedByUserId: "cashier-a",
      approvedByUserId: null,
      submittedAt: new Date(),
      approvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await approveCanteenReconciliation(ADMIN_CTX, "rec-1", db);
    expect(result.reconciliation.status).toBe("APPROVED");
  });

  it("prevents editing an approved reconciliation", async () => {
    const { db, reconciliations } = makeDb();
    reconciliations.push({
      id: "rec-1",
      schoolId: "school-a",
      date: new Date("2026-06-24T00:00:00.000Z"),
      shiftName: null,
      cashierUserId: null,
      canteenOperatorUserId: null,
      openingWalletBalanceCents: 100000,
      totalTopUpsCents: 50000,
      totalCashTopUpsCents: 50000,
      totalMobileMoneyTopUpsCents: 0,
      totalParentDepositTopUpsCents: 0,
      totalAdjustmentTopUpsCents: 0,
      totalCanteenChargesCents: 20000,
      totalReversalsCents: 20000,
      netCanteenPayableCents: 0,
      closingWalletBalanceCents: 140000,
      declaredCashCents: 50000,
      declaredMobileMoneyCents: 0,
      varianceCents: 0,
      status: "APPROVED",
      notes: null,
      submittedByUserId: "cashier-a",
      approvedByUserId: "admin-a",
      submittedAt: new Date(),
      approvedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(closeCanteenReconciliation(ADMIN_CTX, {
      date: "2026-06-24",
      declaredCashUgx: 500,
      declaredMobileMoneyUgx: 0,
      notes: "Adjustments",
    }, db)).rejects.toMatchObject({ status: 409 });
  });
});
