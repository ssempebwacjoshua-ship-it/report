import { getSnapshotCounts, getSnapshotMeta } from "./offlineStore";
import type { OfflineKioskMode, OfflineModule, OfflineSnapshotMeta } from "./offlineTypes";

type SnapshotRequirement = {
  schoolId?: string;
  deviceId?: string;
  mode?: OfflineKioskMode;
  requiredModule?: OfflineModule;
};

export type SnapshotInvalidReason =
  | "no_snapshot"
  | "expired"
  | "wrong_school"
  | "wrong_device"
  | "missing_module"
  | "empty_students"
  | "empty_tags"
  | "offline_disabled_by_policy";

export type SnapshotValidity = {
  valid: boolean;
  reason?: SnapshotInvalidReason;
  meta?: OfflineSnapshotMeta;
  diagnostics: {
    snapshotExists: boolean;
    snapshotId?: string;
    snapshotSchoolId?: string;
    currentSchoolId?: string;
    snapshotDeviceId?: string;
    currentDeviceId?: string;
    mode?: OfflineKioskMode;
    modules?: OfflineModule[];
    generatedAt?: string;
    expiresAt?: string;
    expired: boolean;
    studentCount: number;
    tagCount: number;
    walletCount: number;
    requiredModule?: OfflineModule;
    reason?: SnapshotInvalidReason;
  };
};

function isOfflineEnabled(meta: OfflineSnapshotMeta, module?: OfflineModule): boolean {
  if (module === "gate" || module === "attendance") return meta.settings.gateOfflineEnabled;
  if (module === "canteen") return meta.settings.canteenOfflineEnabled;
  return meta.settings.gateOfflineEnabled || meta.settings.canteenOfflineEnabled;
}

export async function getSnapshotValidity(requirement: SnapshotRequirement = {}): Promise<SnapshotValidity> {
  const meta = await getSnapshotMeta(requirement);
  const counts = await getSnapshotCounts(meta?.schoolId ?? requirement.schoolId);
  const expired = meta ? new Date(meta.expiresAt) <= new Date() : false;

  const baseDiagnostics: SnapshotValidity["diagnostics"] = {
    snapshotExists: !!meta,
    snapshotId: meta?.snapshotId,
    snapshotSchoolId: meta?.schoolId,
    currentSchoolId: requirement.schoolId,
    snapshotDeviceId: meta?.deviceId,
    currentDeviceId: requirement.deviceId,
    mode: meta?.mode,
    modules: meta?.modules,
    generatedAt: meta?.generatedAt,
    expiresAt: meta?.expiresAt,
    expired,
    ...counts,
    requiredModule: requirement.requiredModule,
  };

  function invalid(reason: SnapshotInvalidReason): SnapshotValidity {
    return { valid: false, reason, meta: meta ?? undefined, diagnostics: { ...baseDiagnostics, reason } };
  }

  if (!meta) return invalid("no_snapshot");
  if (expired) return invalid("expired");
  if (requirement.schoolId && meta.schoolId !== requirement.schoolId) return invalid("wrong_school");
  if (requirement.deviceId && meta.deviceId !== requirement.deviceId) return invalid("wrong_device");
  if (requirement.requiredModule && !meta.modules.includes(requirement.requiredModule)) return invalid("missing_module");
  if (!isOfflineEnabled(meta, requirement.requiredModule)) return invalid("offline_disabled_by_policy");
  if (counts.studentCount <= 0) return invalid("empty_students");
  if (counts.tagCount <= 0) return invalid("empty_tags");

  return { valid: true, meta, diagnostics: baseDiagnostics };
}

export async function isSnapshotValid(requirement: SnapshotRequirement = {}): Promise<boolean> {
  return (await getSnapshotValidity(requirement)).valid;
}

export async function isCanteenOfflineEnabled(requirement: SnapshotRequirement = {}): Promise<boolean> {
  const meta = await getSnapshotMeta(requirement);
  return meta?.settings.canteenOfflineEnabled ?? false;
}
