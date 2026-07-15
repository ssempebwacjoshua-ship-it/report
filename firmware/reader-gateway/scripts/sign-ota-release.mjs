import fs from "node:fs";
import path from "node:path";
import { createHash, createSign } from "node:crypto";

function parseArgs(argv) {
  const result = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) {
      result[match[1]] = match[2];
    }
  }
  return result;
}

function requireArg(args, name) {
  const value = args[name];
  if (!value) {
    throw new Error(`Missing required argument --${name}=...`);
  }
  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const args = parseArgs(process.argv.slice(2));
const artifactPath = path.resolve(requireArg(args, "artifact"));
const version = requireArg(args, "version");
const channel = requireArg(args, "channel");
const publicKeyId = requireArg(args, "publicKeyId");
const privateKeyPath = path.resolve(requireArg(args, "privateKey"));
const deviceId = args.deviceId?.trim();
const artifactPathForRailway = args.artifactPath ?? path.relative(process.cwd(), artifactPath).replace(/\\/g, "/");
const releaseId = args.releaseId ?? `ssamenj-reader-gateway-${version}-${channel}`;
const outputPath = args.output ? path.resolve(args.output) : "";

const firmware = fs.readFileSync(artifactPath);
const sha256 = createHash("sha256").update(firmware).digest("hex");
const signature = createSign("sha256").update(firmware).end().sign({
  key: fs.readFileSync(privateKeyPath, "utf8"),
  dsaEncoding: "der",
}).toString("base64");

const routeManifest = {
  updateAvailable: true,
  releaseId,
  version,
  channel,
  downloadPath: `/api/readers/ota/download/${encodeURIComponent(releaseId)}`,
  sha256,
  signature,
  signatureAlgorithm: "ECDSA_P256_SHA256",
  publicKeyId,
  sizeBytes: firmware.byteLength,
};

const railwayRelease = {
  releaseId,
  version,
  channel,
  sha256,
  signature,
  signatureAlgorithm: "ECDSA_P256_SHA256",
  publicKeyId,
  sizeBytes: firmware.byteLength,
  artifactPath: artifactPathForRailway,
  enabled: true,
  ...(deviceId ? { targetDeviceIds: [deviceId] } : {}),
};

const payload = {
  releaseId,
  version,
  channel,
  artifactPath: artifactPathForRailway,
  sha256,
  routeManifestCanonicalJson: stableStringify(routeManifest),
  routeManifest,
  railwayRelease,
};

const output = JSON.stringify(payload, null, 2);
if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output);
}
process.stdout.write(`${output}\n`);
