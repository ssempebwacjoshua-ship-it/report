import { getSnapshotMeta } from "./offlineStore";

export async function isSnapshotValid(): Promise<boolean> {
  const meta = await getSnapshotMeta();
  if (!meta) return false;
  return new Date(meta.expiresAt) > new Date();
}

export async function isCanteenOfflineEnabled(): Promise<boolean> {
  const meta = await getSnapshotMeta();
  return meta?.settings.canteenOfflineEnabled ?? false;
}
