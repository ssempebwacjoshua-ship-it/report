import { normalizeNfcScanValue } from "../shared/utils/nfcPayload";
import { getTagByScanValue, getStudentById, getOfflineWallet } from "./offlineStore";
import type { OfflineResolveResult } from "./offlineTypes";

const BLOCKED_STATUSES = new Set(["DISABLED", "LOST"]);
const ACTIVE_STATUSES = new Set(["ASSIGNED"]);

export async function resolveOfflineNfcScan(
  schoolId: string,
  rawValue: string,
): Promise<OfflineResolveResult> {
  const normalized = normalizeNfcScanValue(rawValue);

  const tag = await getTagByScanValue(schoolId, normalized);

  if (!tag) {
    return { found: false, blocked: true, reason: "unknown token" };
  }

  if (BLOCKED_STATUSES.has(tag.status)) {
    return { found: true, blocked: true, reason: tag.status === "LOST" ? "lost or deactivated wristband" : "wristband disabled", tag };
  }

  if (!tag.studentId || !ACTIVE_STATUSES.has(tag.status)) {
    return { found: true, blocked: true, reason: "unassigned tag", tag };
  }

  const student = await getStudentById(schoolId, tag.studentId);

  if (!student) {
    return { found: true, blocked: true, reason: "student not found in offline snapshot", tag };
  }

  if (!student.isActive) {
    return { found: true, blocked: true, reason: "inactive student", student, tag };
  }

  const wallet = await getOfflineWallet(schoolId, student.id);

  return { found: true, blocked: false, student, tag, wallet: wallet ?? undefined };
}
