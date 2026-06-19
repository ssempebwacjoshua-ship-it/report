import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import {
  getLedger,
  getPaymentNetworkConfig,
  getSmartPagesPackage,
  getSmartPagesPaymentConfig,
  getSummary,
} from "../services/smartPagesService";
import type {
  SmartPageLedgerEntry,
  SmartPagesPaymentNetwork,
  SmartPagesPackageCode,
  SmartPagesPaymentRequest,
  SmartPagesSchoolLedgerRow,
} from "../../shared/types/smartPages";

const preparePaymentSchema = z.object({
  packageCode: z.enum(["TRIAL", "STARTER", "STANDARD", "SCHOOL_PRO"]),
  network: z.enum(["AIRTEL", "MTN"]),
  amountUgx: z.number().int().min(0),
});

const receiptSchema = z.object({
  packageCode: z.enum(["TRIAL", "STARTER", "STANDARD", "SCHOOL_PRO"]),
  network: z.enum(["AIRTEL", "MTN"]),
  amountUgx: z.number().int().min(0),
  transactionId: z.string().trim().min(1, "Transaction ID is required."),
  payerPhone: z.string().trim().max(40).optional(),
  proofScreenshotUrl: z.string().trim().max(1000).optional(),
});

function paymentReference(id: string): string {
  return `SMARTPAGES-${id}`;
}

function paymentToDto(row: any, schoolName?: string): SmartPagesPaymentRequest {
  return {
    id: row.id as string,
    schoolId: row.schoolId as string,
    schoolName,
    packageCode: row.packageCode as SmartPagesPackageCode,
    packageName: row.packageName as string,
    credits: row.credits as number,
    amountUgx: row.amountUgx as number,
    network: row.network as SmartPagesPaymentNetwork,
    merchantCode: row.merchantCode as string,
    merchantName: row.merchantName as string,
    paymentReference: row.paymentReference as string,
    transactionId: row.transactionId as string | null,
    payerPhone: row.payerPhone as string | null,
    proofScreenshotUrl: row.proofScreenshotUrl as string | null,
    status: row.status as SmartPagesPaymentRequest["status"],
    adminNotes: row.adminNotes as string | null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: row.updatedAt ? (row.updatedAt as Date).toISOString() : undefined,
  };
}

function ledgerToSchoolRow(entry: SmartPageLedgerEntry): SmartPagesSchoolLedgerRow {
  return {
    id: entry.id,
    operation: entry.operation ?? (entry.action === "TOP_UP" ? "TOP_UP" : "EXTRACT"),
    pagesProcessed: entry.pagesProcessed ?? entry.pagesCharged,
    creditsUsed: entry.creditsCharged ?? entry.pagesCharged,
    creditsRemainingAfter: null,
    priceUgx: entry.priceUgx ?? 0,
    status: entry.status,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  };
}

export function smartPagesBillingRoutes() {
  const router = Router();

  router.get("/api/smart-pages/billing/config", (_req, res) => {
    res.json(getSmartPagesPaymentConfig());
  });

  router.get("/api/smart-pages/billing/summary", async (req, res, next) => {
    try {
      const schoolId = req.school!.id;
      const [summary, ledger, payments] = await Promise.all([
        getSummary(schoolId),
        getLedger(schoolId, 50),
        (prisma as any).smartPagePaymentRequest.findMany({
          where: { schoolId },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      ]);
      res.json({
        summary,
        ledger: ledger.map(ledgerToSchoolRow),
        payments: payments.map((payment: any) => paymentToDto(payment, req.school!.name)),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/smart-pages/billing/payments", async (req, res, next) => {
    try {
      const body = preparePaymentSchema.parse(req.body);
      const pkg = getSmartPagesPackage(body.packageCode);
      const network = getPaymentNetworkConfig(body.network);
      if (!pkg) {
        res.status(400).json({ error: "Package is required." });
        return;
      }
      if (!network) {
        res.status(400).json({ error: "Network is required." });
        return;
      }
      if (body.amountUgx !== pkg.priceUgx) {
        res.status(400).json({ error: "Amount must match the selected Smart Pages package." });
        return;
      }

      const id = randomUUID();
      const payment = await (prisma as any).smartPagePaymentRequest.create({
        data: {
          id,
          schoolId: req.school!.id,
          packageCode: pkg.code,
          packageName: pkg.name,
          credits: pkg.credits,
          amountUgx: pkg.priceUgx,
          network: network.network,
          merchantCode: network.merchantCode,
          merchantName: network.merchantName,
          paymentReference: paymentReference(id),
          status: "PENDING",
        },
      });

      res.status(201).json({ payment: paymentToDto(payment, req.school!.name) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/smart-pages/billing/payments/:paymentId/receipt", async (req, res, next) => {
    try {
      const body = receiptSchema.parse(req.body);
      const payment = await (prisma as any).smartPagePaymentRequest.findFirst({
        where: { id: req.params.paymentId, schoolId: req.school!.id },
      });
      if (!payment) {
        res.status(404).json({ error: "Payment request not found." });
        return;
      }
      if (payment.status !== "PENDING") {
        res.status(409).json({ error: "Only pending payment requests can be updated." });
        return;
      }
      if (payment.packageCode !== body.packageCode || payment.network !== body.network) {
        res.status(400).json({ error: "Network and package must match the selected payment request." });
        return;
      }
      if (payment.amountUgx !== body.amountUgx) {
        res.status(400).json({ error: "Amount must match the selected Smart Pages package." });
        return;
      }
      const duplicate = await (prisma as any).smartPagePaymentRequest.findFirst({
        where: {
          network: body.network,
          transactionId: body.transactionId,
          NOT: { id: payment.id },
        },
      });
      if (duplicate) {
        res.status(409).json({ error: "This transaction ID has already been submitted for this network." });
        return;
      }

      const updated = await (prisma as any).smartPagePaymentRequest.update({
        where: { id: payment.id },
        data: {
          transactionId: body.transactionId,
          payerPhone: body.payerPhone || null,
          proofScreenshotUrl: body.proofScreenshotUrl || null,
        },
      });

      res.json({ payment: paymentToDto(updated, req.school!.name) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
