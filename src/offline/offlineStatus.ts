import { getSnapshotMeta } from "./offlineStore";
import type { OfflineModule } from "./offlineTypes";

type SnapshotRequirement = {
  schoolId?: string;
  deviceId?: string;
  requiredModule?: OfflineModule;
};

export async function isSnapshotValid(requirement: SnapshotRequirement = {}): Promise<boolean> {
  const meta = await getSnapshotMeta();
  if (!meta) return false;
  if (new Date(meta.expiresAt) <= new Date()) return false;
  if (requirement.schoolId && meta.schoolId !== requirement.schoolId) return false;
  if (requirement.deviceId && meta.deviceId !== requirement.deviceId) return false;
  if (requirement.requiredModule && !meta.modules.includes(requirement.requiredModule)) return false;
  return true;
}

export async function isCanteenOfflineEnabled(): Promise<boolean> {
  const meta = await getSnapshotMeta();
  return meta?.settings.canteenOfflineEnabled ?? false;
}
