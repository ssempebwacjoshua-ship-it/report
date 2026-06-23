// Tamper-evident hash chain using Web Crypto SHA-256.
// If someone edits IndexedDB rows manually, the chain breaks on sync validation.

function deterministicStringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(deterministicStringify).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${k}:${deterministicStringify((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return String(value);
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPayload(payload: unknown): Promise<string> {
  return sha256Hex(deterministicStringify(payload));
}

// eventHash = sha256(previousHash | payloadHash | deviceId | sequenceNumber | createdAt | actionType)
export async function createOfflineEventHash(params: {
  previousHash: string | null;
  payloadHash: string;
  deviceId: string;
  sequenceNumber: number;
  createdAt: string;
  actionType: string;
}): Promise<string> {
  const chain = [
    params.previousHash ?? "",
    params.payloadHash,
    params.deviceId,
    String(params.sequenceNumber),
    params.createdAt,
    params.actionType,
  ].join("|");
  return sha256Hex(chain);
}
