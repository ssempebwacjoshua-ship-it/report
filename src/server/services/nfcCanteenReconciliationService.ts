import { WalletTransactionType, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma";
import type { SchoolUserRole } from "./authService";
import { hasPermission } from "../../shared/permissions";

type ReconciliationClient = Pick<
  PrismaClient,
  "studentWalletTransaction" | "studentWallet" | "canteenReconciliation" | "auditLog" | "user"
> & {
  $transaction?: <T>(fn: (tx: ReconciliationClient) => Promise<T>) => Promise<T>;
};

export type ReconciliationContext = {
  schoolId?: string | null;
  actorId?: string | null;
  role?: SchoolUserRole | string | null;
};

export type CanteenReconciliationFilters = {
  date?: string;
  cashierUserId?: string;
  shiftName?: string;
};

export type CanteenReconciliationCloseInput = {
  date: string;
  cashierUserId?: string | null;
  shiftName?: string | null;
  canteenOperatorUserId?: string | null;
  declaredCashUgx: number;
  declaredMobileMoneyUgx: number;
  notes?: string | null;
};

export type CanteenReconciliationTransactionRow = {
  id: string;
  time: string;
  student: {
    id: string;
    name: string;
    admissionNumber: string;
    className: string | null;
    streamName: string | null;
    photoUrl: string | null;
  };
  type: "TOP_UP" | "CHARGE" | "REVERSAL" | "ADJUSTMENT";
  method: string | null;
  amountCents: number;
  balanceAfterCents: number | null;
  cashierOperator: string | null;
  reference: string | null;
  status: "COMPLETED" | "PENDING" | "FAILED" | "REVERSED";
};

export type CanteenReconciliationSummary = {
  openingWalletBalanceCents: number;
  totalTopUpsCents: number;
  totalCashTopUpsCents: number;
  totalMobileMoneyTopUpsCents: number;
  totalParentDepositTopUpsCents: number;
  totalAdjustmentTopUpsCents: number;
  totalCanteenChargesCents: number;
  totalReversalsCents: number;
  netCanteenPayableCents: number;
  closingWalletBalanceCents: number;
  netWalletMovementCents: number;
  declaredCashCents: number;
  declaredMobileMoneyCents: number;
  varianceCents: number;
};

export type CanteenReconciliationRecord = {
  id: string;
  schoolId: string;
  date: string;
  shiftName: string | null;
  cashierUserId: string | null;
  canteenOperatorUserId: string | null;
  openingWalletBalanceCents: number;
  totalTopUpsCents: number;
  totalCashTopUpsCents: number;
  totalMobileMoneyTopUpsCents: number;
  totalParentDepositTopUpsCents: number;
  totalAdjustmentTopUpsCents: number;
  totalCanteenChargesCents: number;
  totalReversalsCents: number;
  netCanteenPayableCents: number;
  closingWalletBalanceCents: number;
  declaredCashCents: number | null;
  declaredMobileMoneyCents: number | null;
  varianceCents: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  notes: string | null;
  submittedByUserId: string | null;
  approvedByUserId: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CanteenReconciliationResponse = {
  date: string;
  cashierUserId: string | null;
  cashier: { id: string; name: string } | null;
  shiftName: string | null;
  summary: CanteenReconciliationSummary;
  reconciliation: CanteenReconciliationRecord | null;
  transactions: CanteenReconciliationTransactionRow[];
  canClose: boolean;
  canApprove: boolean;
  canReject: boolean;
};

function requireSchoolId(ctx: ReconciliationContext): string {
  if (!ctx.schoolId) throw Object.assign(new Error("School context required."), { status: 401 });
  return ctx.schoolId;
}

function requirePermission(ctx: ReconciliationContext, permission: string) {
  if (!ctx.actorId || !ctx.role) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (!hasPermission(ctx.role, permission)) {
    throw Object.assign(new Error("You do not have permission for this action."), { status: 403 });
  }
}

function requireAdmin(ctx: ReconciliationContext) {
  if (!ctx.actorId || !ctx.role) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (ctx.role !== "ADMIN_OPERATOR") {
    throw Object.assign(new Error("Only administrators can approve or reject reconciliations."), { status: 403 });
  }
}

function runWrite<T>(db: ReconciliationClient, fn: (tx: ReconciliationClient) => Promise<T>) {
  return db.$transaction ? db.$transaction(fn) : fn(db);
}

function parseDateInput(date: string | undefined) {
  const selected = date ? new Date(date) : new Date();
  if (Number.isNaN(selected.getTime())) {
    throw Object.assign(new Error("Invalid reconciliation date."), { status: 400 });
  }
  const start = new Date(selected);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end, dateKey: start.toISOString().slice(0, 10) };
}

function moneyAmount(value: number) {
  return Math.round(Number(value) || 0);
}

function studentSummary(student: {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  enrollments?: Array<{
    class?: { name: string } | null;
    stream?: { name: string } | null;
  }>;
}) {
  const enrollment = student.enrollments?.[0];
  return {
    id: student.id,
    name: `${student.firstName} ${student.lastName}`.trim(),
    admissionNumber: student.admissionNumber,
    className: enrollment?.class?.name ?? null,
    streamName: enrollment?.stream?.name ?? null,
    photoUrl: null,
  };
}

async function loadTransactions(
  db: ReconciliationClient,
  schoolId: string,
  start: Date,
  end: Date,
  cashierUserId?: string,
) {
  return db.studentWalletTransaction.findMany({
    where: {
      schoolId,
      createdAt: { gte: start, lt: end },
      ...(cashierUserId ? { cashierUserId } : {}),
    },
    include: {
      student: {
        select: {
          id: true,
          admissionNumber: true,
          firstName: true,
          lastName: true,
          enrollments: {
            where: { isActive: true, status: "ACTIVE" as const },
            include: { class: { select: { name: true } }, stream: { select: { name: true } } },
            orderBy: { createdAt: "desc" as const },
            take: 1,
          },
        },
      },
      cashier: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

async function buildResponse(
  db: ReconciliationClient,
  ctx: ReconciliationContext,
  schoolId: string,
  date: string | undefined,
  cashierUserId?: string,
  shiftName?: string | null,
): Promise<CanteenReconciliationResponse> {
  const { start, end, dateKey } = parseDateInput(date);
  const transactions = await loadTransactions(db, schoolId, start, end, cashierUserId);
  const wallets = await db.studentWallet.findMany({ where: { schoolId } });
  const currentClosingWalletBalanceCents = wallets.reduce((sum, wallet) => sum + wallet.balanceCents, 0);

  const reversalOriginalTypes = new Map<string, WalletTransactionType | null>();
  for (const transaction of transactions) {
    if (transaction.type !== WalletTransactionType.REVERSAL || !transaction.reversalOfId) continue;
    const original = await db.studentWalletTransaction.findFirst({
      where: { schoolId, id: transaction.reversalOfId },
      select: { type: true },
    });
    reversalOriginalTypes.set(transaction.id, original?.type ?? null);
  }

  const topUps = transactions.filter((transaction) => transaction.type === WalletTransactionType.TOP_UP);
  const charges = transactions.filter((transaction) => transaction.type === WalletTransactionType.CHARGE);
  const reversals = transactions.filter((transaction) => transaction.type === WalletTransactionType.REVERSAL);
  const adjustments = transactions.filter((transaction) => transaction.type === WalletTransactionType.ADJUSTMENT);

  const totalCashTopUpsCents = topUps
    .filter((transaction) => transaction.paymentMethod === "CASH")
    .reduce((sum, transaction) => sum + moneyAmount(transaction.amountCents), 0);
  const totalMobileMoneyTopUpsCents = topUps
    .filter((transaction) => transaction.paymentMethod === "MOBILE_MONEY")
    .reduce((sum, transaction) => sum + moneyAmount(transaction.amountCents), 0);
  const totalParentDepositTopUpsCents = topUps
    .filter((transaction) => transaction.paymentMethod === "PARENT_DEPOSIT")
    .reduce((sum, transaction) => sum + moneyAmount(transaction.amountCents), 0);
  const totalAdjustmentTopUpsCents = topUps
    .filter((transaction) => transaction.paymentMethod === "ADJUSTMENT")
    .reduce((sum, transaction) => sum + moneyAmount(transaction.amountCents), 0);
  const totalTopUpsCents = topUps.reduce((sum, transaction) => sum + moneyAmount(transaction.amountCents), 0);
  const totalCanteenChargesCents = charges.reduce((sum, transaction) => sum + Math.abs(moneyAmount(transaction.amountCents)), 0);
  const totalReversalsCents = reversals.reduce((sum, transaction) => sum + Math.abs(moneyAmount(transaction.amountCents)), 0);
  const totalCanteenReversalsCents = reversals.reduce((sum, transaction) => {
    const originalType = reversalOriginalTypes.get(transaction.id);
    return originalType === WalletTransactionType.CHARGE ? sum + Math.abs(moneyAmount(transaction.amountCents)) : sum;
  }, 0);
  const netCanteenPayableCents = totalCanteenChargesCents - totalCanteenReversalsCents;
  const netWalletMovementCents = transactions.reduce((sum, transaction) => sum + moneyAmount(transaction.amountCents), 0);
  const openingWalletBalanceCents = currentClosingWalletBalanceCents - netWalletMovementCents;
  const declaredCashCents = totalCashTopUpsCents;
  const declaredMobileMoneyCents = totalMobileMoneyTopUpsCents;
  const varianceCents = declaredCashCents + declaredMobileMoneyCents - totalTopUpsCents;

  const uniqueCashierIds = Array.from(new Set(transactions.map((transaction) => transaction.cashierUserId).filter(Boolean) as string[]));
  const cashierUsers = uniqueCashierIds.length
    ? await db.user.findMany({ where: { id: { in: uniqueCashierIds } }, select: { id: true, name: true } })
    : [];
  const cashierNameById = new Map(cashierUsers.map((user) => [user.id, user.name]));

  const reconciliation = await db.canteenReconciliation.findFirst({
    where: {
      schoolId,
      date: start,
      ...(cashierUserId ? { cashierUserId } : {}),
      ...(shiftName ? { shiftName } : {}),
    },
  });

  return {
    date: dateKey,
    cashierUserId: cashierUserId ?? null,
    cashier: cashierUserId ? cashierUsers.find((user) => user.id === cashierUserId) ?? null : null,
    shiftName: shiftName ?? null,
    summary: {
      openingWalletBalanceCents,
      totalTopUpsCents,
      totalCashTopUpsCents,
      totalMobileMoneyTopUpsCents,
      totalParentDepositTopUpsCents,
      totalAdjustmentTopUpsCents,
      totalCanteenChargesCents,
      totalReversalsCents,
      netCanteenPayableCents,
      closingWalletBalanceCents: currentClosingWalletBalanceCents,
      netWalletMovementCents,
      declaredCashCents,
      declaredMobileMoneyCents,
      varianceCents,
    },
    reconciliation: reconciliation
      ? {
          id: reconciliation.id,
          schoolId: reconciliation.schoolId,
          date: reconciliation.date.toISOString().slice(0, 10),
          shiftName: reconciliation.shiftName,
          cashierUserId: reconciliation.cashierUserId,
          canteenOperatorUserId: reconciliation.canteenOperatorUserId,
          openingWalletBalanceCents: reconciliation.openingWalletBalanceCents,
          totalTopUpsCents: reconciliation.totalTopUpsCents,
          totalCashTopUpsCents: reconciliation.totalCashTopUpsCents,
          totalMobileMoneyTopUpsCents: reconciliation.totalMobileMoneyTopUpsCents,
          totalParentDepositTopUpsCents: reconciliation.totalParentDepositTopUpsCents,
          totalAdjustmentTopUpsCents: reconciliation.totalAdjustmentTopUpsCents,
          totalCanteenChargesCents: reconciliation.totalCanteenChargesCents,
          totalReversalsCents: reconciliation.totalReversalsCents,
          netCanteenPayableCents: reconciliation.netCanteenPayableCents,
          closingWalletBalanceCents: reconciliation.closingWalletBalanceCents,
          declaredCashCents: reconciliation.declaredCashCents,
          declaredMobileMoneyCents: reconciliation.declaredMobileMoneyCents,
          varianceCents: reconciliation.varianceCents,
          status: reconciliation.status,
          notes: reconciliation.notes,
          submittedByUserId: reconciliation.submittedByUserId,
          approvedByUserId: reconciliation.approvedByUserId,
          submittedAt: reconciliation.submittedAt ? reconciliation.submittedAt.toISOString() : null,
          approvedAt: reconciliation.approvedAt ? reconciliation.approvedAt.toISOString() : null,
          createdAt: reconciliation.createdAt.toISOString(),
          updatedAt: reconciliation.updatedAt.toISOString(),
        }
      : null,
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      time: transaction.createdAt.toISOString(),
      student: studentSummary(transaction.student as Parameters<typeof studentSummary>[0]),
      type: transaction.type,
      method: transaction.type === WalletTransactionType.CHARGE ? "WALLET_CHARGE" : transaction.paymentMethod ?? null,
      amountCents: moneyAmount(transaction.amountCents),
      balanceAfterCents: transaction.balanceAfterCents ?? null,
      cashierOperator: transaction.cashier?.name ?? cashierNameById.get(transaction.cashierUserId ?? "") ?? transaction.cashierUserId ?? null,
      reference: transaction.reference ?? null,
      status: "COMPLETED" as const,
    })),
    canClose: ctx.role ? hasPermission(ctx.role, "nfc.canteen.reconciliation.submit") : false,
    canApprove: ctx.role === "ADMIN_OPERATOR",
    canReject: ctx.role === "ADMIN_OPERATOR",
  };
}

function buildReconciliationRecord(
  schoolId: string,
  summary: CanteenReconciliationSummary,
  input: CanteenReconciliationCloseInput,
  now = new Date(),
) {
  const declaredCashCents = moneyAmount(input.declaredCashUgx * 100);
  const declaredMobileMoneyCents = moneyAmount(input.declaredMobileMoneyUgx * 100);
  const varianceCents = declaredCashCents + declaredMobileMoneyCents - summary.totalTopUpsCents;
  return {
    schoolId,
    date: parseDateInput(input.date).start,
    shiftName: input.shiftName?.trim() || null,
    cashierUserId: input.cashierUserId ?? null,
    canteenOperatorUserId: input.canteenOperatorUserId ?? null,
    openingWalletBalanceCents: summary.openingWalletBalanceCents,
    totalTopUpsCents: summary.totalTopUpsCents,
    totalCashTopUpsCents: summary.totalCashTopUpsCents,
    totalMobileMoneyTopUpsCents: summary.totalMobileMoneyTopUpsCents,
    totalParentDepositTopUpsCents: summary.totalParentDepositTopUpsCents,
    totalAdjustmentTopUpsCents: summary.totalAdjustmentTopUpsCents,
    totalCanteenChargesCents: summary.totalCanteenChargesCents,
    totalReversalsCents: summary.totalReversalsCents,
    netCanteenPayableCents: summary.netCanteenPayableCents,
    closingWalletBalanceCents: summary.closingWalletBalanceCents,
    declaredCashCents,
    declaredMobileMoneyCents,
    varianceCents,
    status: "SUBMITTED" as const,
    notes: input.notes?.trim() || null,
    submittedByUserId: null,
    approvedByUserId: null,
    submittedAt: now,
    approvedAt: null,
  };
}

export async function getCanteenReconciliation(
  ctx: ReconciliationContext,
  filters: CanteenReconciliationFilters = {},
  db: ReconciliationClient = defaultPrisma,
): Promise<CanteenReconciliationResponse> {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.canteen.reconciliation.view");
  return buildResponse(db, ctx, schoolId, filters.date, filters.cashierUserId, filters.shiftName);
}

export async function closeCanteenReconciliation(
  ctx: ReconciliationContext,
  input: CanteenReconciliationCloseInput,
  db: ReconciliationClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.canteen.reconciliation.submit");
  if (!input.date.trim()) throw Object.assign(new Error("Reconciliation date is required."), { status: 400 });
  const current = await buildResponse(db, ctx, schoolId, input.date, input.cashierUserId ?? undefined, input.shiftName ?? undefined);
  const notes = input.notes?.trim() || null;
  const record = buildReconciliationRecord(schoolId, current.summary, input);
  if (record.varianceCents !== 0 && !notes) {
    throw Object.assign(new Error("Notes are required when variance is not zero."), { status: 400 });
  }

  return runWrite(db, async (tx) => {
    const { start } = parseDateInput(input.date);
    const existing = await tx.canteenReconciliation.findFirst({
      where: {
        schoolId,
        date: start,
        ...(input.cashierUserId ? { cashierUserId: input.cashierUserId } : {}),
        ...(input.shiftName ? { shiftName: input.shiftName.trim() } : {}),
      },
    });

    if (existing && (existing.status === "SUBMITTED" || existing.status === "APPROVED")) {
      throw Object.assign(new Error("This reconciliation is locked and cannot be edited."), { status: 409 });
    }

    const saved = existing
      ? await tx.canteenReconciliation.update({
          where: { id: existing.id },
          data: {
            ...record,
            status: "SUBMITTED",
            notes,
            submittedByUserId: ctx.actorId ?? null,
            submittedAt: new Date(),
          },
        })
      : await tx.canteenReconciliation.create({
          data: {
            ...record,
            status: "SUBMITTED",
            notes,
            submittedByUserId: ctx.actorId ?? null,
            submittedAt: new Date(),
          },
        });

    await tx.auditLog.create({
      data: {
        schoolId,
        action: "nfc_canteen_reconciliation.submitted",
        details: {
          reconciliationId: saved.id,
          date: input.date,
          cashierUserId: input.cashierUserId ?? null,
          varianceCents: record.varianceCents,
          actor: { id: ctx.actorId ?? null },
        },
      },
    });

    return { reconciliation: saved };
  });
}

export async function approveCanteenReconciliation(
  ctx: ReconciliationContext,
  reconciliationId: string,
  db: ReconciliationClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireAdmin(ctx);

  return runWrite(db, async (tx) => {
    const reconciliation = await tx.canteenReconciliation.findFirst({ where: { id: reconciliationId, schoolId } });
    if (!reconciliation) throw Object.assign(new Error("Reconciliation not found."), { status: 404 });
    if (reconciliation.status === "APPROVED") {
      throw Object.assign(new Error("This reconciliation is already approved."), { status: 409 });
    }
    if (reconciliation.status !== "SUBMITTED") {
      throw Object.assign(new Error("Only submitted reconciliations can be approved."), { status: 409 });
    }

    const approved = await tx.canteenReconciliation.update({
      where: { id: reconciliation.id },
      data: {
        status: "APPROVED",
        approvedByUserId: ctx.actorId ?? null,
        approvedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        schoolId,
        action: "nfc_canteen_reconciliation.approved",
        details: {
          reconciliationId: approved.id,
          actor: { id: ctx.actorId ?? null },
        },
      },
    });

    return { reconciliation: approved };
  });
}

export async function rejectCanteenReconciliation(
  ctx: ReconciliationContext,
  reconciliationId: string,
  notes?: string | null,
  db: ReconciliationClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireAdmin(ctx);
  if (!notes?.trim()) throw Object.assign(new Error("Rejection notes are required."), { status: 400 });

  return runWrite(db, async (tx) => {
    const reconciliation = await tx.canteenReconciliation.findFirst({ where: { id: reconciliationId, schoolId } });
    if (!reconciliation) throw Object.assign(new Error("Reconciliation not found."), { status: 404 });
    if (reconciliation.status === "APPROVED") {
      throw Object.assign(new Error("Approved reconciliations cannot be rejected."), { status: 409 });
    }
    if (reconciliation.status !== "SUBMITTED") {
      throw Object.assign(new Error("Only submitted reconciliations can be rejected."), { status: 409 });
    }

    const rejected = await tx.canteenReconciliation.update({
      where: { id: reconciliation.id },
      data: {
        status: "REJECTED",
        notes: notes.trim(),
      },
    });

    await tx.auditLog.create({
      data: {
        schoolId,
        action: "nfc_canteen_reconciliation.rejected",
        details: {
          reconciliationId: rejected.id,
          reason: notes.trim(),
          actor: { id: ctx.actorId ?? null },
        },
      },
    });

    return { reconciliation: rejected };
  });
}
