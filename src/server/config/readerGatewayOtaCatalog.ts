import path from "node:path";

type ReaderGatewayOtaRelease = {
  releaseId: string;
  version: string;
  channel: string;
  sha256: string;
  signature: string;
  signatureAlgorithm: string;
  publicKeyId?: string;
  sizeBytes?: number;
  artifactPath: string;
  enabled?: boolean;
  targetDeviceIds?: string[];
};

export type ReaderGatewayOtaDeviceContext = {
  deviceId: string;
  deviceKey: string;
  firmwareChannel: string;
  currentVersion: string;
};

export type ReaderGatewayResolvedRelease = ReaderGatewayOtaRelease & {
  artifactPath: string;
};

function parseVersion(value: string) {
  return value.split(".").map((part) => Number.parseInt(part, 10)).filter((part) => Number.isFinite(part));
}

function compareVersions(left: string, right: string) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const av = a[index] ?? 0;
    const bv = b[index] ?? 0;
    if (av !== bv) {
      return av - bv;
    }
  }
  return 0;
}

function loadReaderGatewayOtaCatalog(): ReaderGatewayResolvedRelease[] {
  const raw = process.env.READER_GATEWAY_OTA_RELEASES_JSON?.trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as ReaderGatewayOtaRelease[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item && typeof item === "object" && item.enabled !== false)
      .map((item) => ({
        ...item,
        artifactPath: path.isAbsolute(item.artifactPath)
          ? item.artifactPath
          : path.resolve(process.cwd(), item.artifactPath),
      }));
  } catch {
    return [];
  }
}

export function findReaderGatewayOtaRelease(context: ReaderGatewayOtaDeviceContext) {
  const releases = loadReaderGatewayOtaCatalog();
  const eligible = releases.filter((release) => {
    const targets = release.targetDeviceIds ?? [];
    const targeted = targets.includes(context.deviceId) || targets.includes(context.deviceKey);
    if (targets.length > 0) {
      return targeted && compareVersions(release.version, context.currentVersion) > 0;
    }
    return release.channel === context.firmwareChannel && compareVersions(release.version, context.currentVersion) > 0;
  });

  eligible.sort((left, right) => {
    const leftTargeted = (left.targetDeviceIds?.length ?? 0) > 0 ? 1 : 0;
    const rightTargeted = (right.targetDeviceIds?.length ?? 0) > 0 ? 1 : 0;
    if (leftTargeted !== rightTargeted) {
      return rightTargeted - leftTargeted;
    }
    return compareVersions(right.version, left.version);
  });

  return eligible[0] ?? null;
}

export function getReaderGatewayOtaReleaseById(releaseId: string) {
  return loadReaderGatewayOtaCatalog().find((release) => release.releaseId === releaseId) ?? null;
}
