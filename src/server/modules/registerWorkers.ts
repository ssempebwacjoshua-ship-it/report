import type { PrismaClient } from "@prisma/client";
import { startBulkGenerationWorker } from "../services/bulkGenerationService";
import { startSmsDeliveryWorker } from "../services/communicationEngine";
import { startDocumentExtractionWorker } from "../services/documentIntelligenceService";
import { recoverStaleStudentImportJobs } from "../services/studentImportService";
import { checkNfcWristbandSchema } from "../utils/nfcSchemaCheck";

export function registerWorkers(prisma: PrismaClient) {
  void recoverStaleStudentImportJobs(prisma).catch((error) => console.error("Failed to recover stale student import jobs", error));
  void checkNfcWristbandSchema(prisma).then((status) => {
    if (!status.ok) {
      console.warn("[startup] NFC wristband schema incomplete. Missing:", status.missing.join(", "));
      console.warn("[startup] Fix: npx prisma migrate deploy");
    } else {
      console.log("[startup] NFC wristband schema OK");
    }
  });

  startBulkGenerationWorker();
  startDocumentExtractionWorker();
  startSmsDeliveryWorker(prisma);
}
