import { normalizeNfcScanValue } from "./nfcPayload";

export type CredentialNormalizationInput = {
  value?: string | null;
  cardNumber?: string | null;
  facilityCode?: string | null;
  rawWiegandDecimal?: string | null;
  rawWiegandHex?: string | null;
};

export type CredentialNormalizationResult = {
  canonical: string;
  lookupValues: string[];
  tokenValues: string[];
  strongAliases: string[];
  weakAliases: string[];
};

export type ReaderCredentialAliasResult = {
  canonical: string;
  aliases: string[];
  strongAliases: string[];
  weakAliases: string[];
  aliasSource: Record<string, ReaderCredentialAliasSource>;
  matchedStrongSource: ReaderCredentialAliasSource | null;
};

export type ReaderCredentialAliasSource =
  | "rawWiegandDecimal"
  | "rawWiegandHex"
  | "credential"
  | "credentialEquivalent"
  | "cardNumber"
  | "cardNumberZeroPadded"
  | "facilityCodeCardNumber"
  | "facilityCodeCardNumberVariant"
  | "rawWiegandDecimalZeroPadded";

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function clean(value: string | null | undefined): string {
  if (!value) return "";
  return normalizeNfcScanValue(value).trim();
}

function stripNumericLeadingZeros(value: string): string {
  if (!/^\d+$/.test(value)) return value;
  return value.replace(/^0+(?=\d)/, "") || "0";
}

function stripHexLeadingZeros(value: string): string {
  const upper = clean(value).toUpperCase();
  if (!/^[0-9A-F]+$/.test(upper)) return upper;
  return upper.replace(/^0+(?=[0-9A-F])/, "") || "0";
}

function addCredentialForms(values: Set<string>, value: string | null | undefined) {
  const cleaned = clean(value);
  if (!cleaned) return;

  const upper = cleaned.toUpperCase();
  values.add(cleaned);
  values.add(upper);

  const noLeadingZeros = stripNumericLeadingZeros(upper);
  values.add(noLeadingZeros);

  if (/^\d+$/.test(noLeadingZeros)) {
    for (const width of [3, 4, 5, 6, 8, 10]) {
      values.add(noLeadingZeros.padStart(width, "0"));
    }
  }
}

export function normalizeCredentialUID(value: string): string {
  return stripNumericLeadingZeros(clean(value).toUpperCase());
}

export function buildReaderCredentialAliases(input: CredentialNormalizationInput): ReaderCredentialAliasResult {
  const strongAliases: string[] = [];
  const weakAliases: string[] = [];
  const aliasSource: Record<string, ReaderCredentialAliasSource> = {};

  function pushStrong(value: string | null | undefined, source: ReaderCredentialAliasSource) {
    const cleaned = clean(value);
    if (!cleaned) return;
    const normalized = source === "rawWiegandHex" ? stripHexLeadingZeros(cleaned) : normalizeCredentialUID(cleaned);
    if (!normalized) return;
    if (!(normalized in aliasSource)) {
      aliasSource[normalized] = source;
      strongAliases.push(normalized);
    }
  }

  function pushWeak(value: string | null | undefined, source: ReaderCredentialAliasSource, preserveCase = false) {
    const cleaned = clean(value);
    if (!cleaned) return;
    const normalized = preserveCase ? cleaned : normalizeCredentialUID(cleaned);
    if (!normalized) return;
    if (!(normalized in aliasSource)) {
      aliasSource[normalized] = source;
      weakAliases.push(normalized);
    }
  }

  const rawWiegandDecimal = normalizeCredentialUID(input.rawWiegandDecimal ?? "");
  const rawWiegandDecimalOriginal = clean(input.rawWiegandDecimal);
  const rawWiegandHex = stripHexLeadingZeros(input.rawWiegandHex ?? "");
  const credential = normalizeCredentialUID(input.value ?? "");
  const cardNumber = normalizeCredentialUID(input.cardNumber ?? "");
  const facilityCode = clean(input.facilityCode).toUpperCase();

  if (rawWiegandDecimal) {
    pushStrong(rawWiegandDecimal, "rawWiegandDecimal");
    if (rawWiegandDecimalOriginal && normalizeCredentialUID(rawWiegandDecimalOriginal) !== rawWiegandDecimalOriginal) {
      pushWeak(rawWiegandDecimalOriginal, "rawWiegandDecimalZeroPadded");
    }
  }

  if (rawWiegandHex) {
    pushStrong(rawWiegandHex, "rawWiegandHex");
  }

  if (credential) {
    if (credential === rawWiegandDecimal || credential === rawWiegandHex) {
      pushStrong(credential, "credentialEquivalent");
    } else if (!rawWiegandDecimal && !rawWiegandHex) {
      pushWeak(credential, "credential");
    }
  }

  if (cardNumber) {
    pushWeak(cardNumber, "cardNumber");
    if (!rawWiegandDecimal && !rawWiegandHex && /^\d+$/.test(cardNumber)) {
      for (const width of [3, 4, 5, 6, 8, 10]) {
        const padded = cardNumber.padStart(width, "0");
        if (padded !== cardNumber) {
          pushWeak(padded, "cardNumberZeroPadded");
        }
      }
    }
  }

  if (facilityCode && cardNumber) {
    pushWeak(`${facilityCode}-${cardNumber}`, "facilityCodeCardNumber", true);
    pushWeak(`${facilityCode}:${cardNumber}`, "facilityCodeCardNumberVariant", true);
  }

  const aliases = unique([...strongAliases, ...weakAliases]);
  return {
    canonical: strongAliases[0] ?? weakAliases[0] ?? "",
    aliases,
    strongAliases: unique(strongAliases),
    weakAliases: unique(weakAliases),
    aliasSource,
    matchedStrongSource: strongAliases[0] ? aliasSource[strongAliases[0]] : null,
  };
}

export function normalizeCredentialForLookup(input: CredentialNormalizationInput): CredentialNormalizationResult {
  const tokenValues = new Set<string>();

  const token = clean(input.value);
  if (token) {
    tokenValues.add(token);
    tokenValues.add(token.toUpperCase());
  }
  const readerAliases = buildReaderCredentialAliases(input);
  const lookupValues = readerAliases.aliases;
  return {
    canonical: readerAliases.canonical,
    lookupValues,
    tokenValues: unique([...tokenValues]),
    strongAliases: readerAliases.strongAliases,
    weakAliases: readerAliases.weakAliases,
  };
}

export function maskCredentialValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleanValue = String(value);
  if (cleanValue.length <= 4) return "*".repeat(cleanValue.length);
  return `${cleanValue.slice(0, 2)}...${cleanValue.slice(-2)} (len ${cleanValue.length})`;
}
