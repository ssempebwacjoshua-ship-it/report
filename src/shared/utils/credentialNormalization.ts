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
};

export type ReaderCredentialAliasResult = {
  canonical: string;
  aliases: string[];
};

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
  const credentialValues = new Set<string>();

  addCredentialForms(credentialValues, input.rawWiegandDecimal);
  addCredentialForms(credentialValues, input.rawWiegandHex);

  if (input.facilityCode && input.cardNumber) {
    addCredentialForms(credentialValues, `${input.facilityCode}-${input.cardNumber}`);
    addCredentialForms(credentialValues, `${input.facilityCode}:${input.cardNumber}`);
  }

  addCredentialForms(credentialValues, input.cardNumber);
  addCredentialForms(credentialValues, input.value);

  const aliases = unique([...credentialValues]);
  return {
    canonical: aliases[0] ?? "",
    aliases,
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
  };
}

export function maskCredentialValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleanValue = String(value);
  if (cleanValue.length <= 4) return "*".repeat(cleanValue.length);
  return `${cleanValue.slice(0, 2)}...${cleanValue.slice(-2)} (len ${cleanValue.length})`;
}
