import { validateScore } from "../../../../shared/utils/validateScore";

export type SupportedScoreCode = "AB" | "EX";

export type ScoreValidationOptions = {
  allowAbsent?: boolean;
  allowExempt?: boolean;
  allowBlank?: boolean;
};

export type ScoreEntryValidation =
  | {
      valid: true;
      kind: "blank";
      normalized: "";
      numericValue: null;
      code: null;
      error: null;
    }
  | {
      valid: true;
      kind: "numeric";
      normalized: string;
      numericValue: number;
      code: null;
      error: null;
    }
  | {
      valid: true;
      kind: "code";
      normalized: SupportedScoreCode;
      numericValue: null;
      code: SupportedScoreCode;
      error: null;
    }
  | {
      valid: false;
      kind: "blank" | "invalid";
      normalized: string;
      numericValue: null;
      code: null;
      error: string;
    };

function describeAllowedValues(options: ScoreValidationOptions): string {
  const values = ["0-100"];
  if (options.allowAbsent) values.push("AB");
  if (options.allowExempt) values.push("EX");
  return values.join(", ");
}

export function validateScoreEntry(
  raw: string | number | null | undefined,
  options: ScoreValidationOptions = {},
): ScoreEntryValidation {
  const normalized = String(raw ?? "").trim().toUpperCase();
  const allowedValues = describeAllowedValues(options);

  if (normalized === "") {
    if (options.allowBlank) {
      return { valid: true, kind: "blank", normalized: "", numericValue: null, code: null, error: null };
    }
    return {
      valid: false,
      kind: "blank",
      normalized,
      numericValue: null,
      code: null,
      error: `Mark is required. Enter ${allowedValues}.`,
    };
  }

  if (normalized === "AB") {
    if (options.allowAbsent) {
      return { valid: true, kind: "code", normalized: "AB", numericValue: null, code: "AB", error: null };
    }
    return {
      valid: false,
      kind: "invalid",
      normalized,
      numericValue: null,
      code: null,
      error: `AB is not allowed here. Enter ${allowedValues}.`,
    };
  }

  if (normalized === "EX") {
    if (options.allowExempt) {
      return { valid: true, kind: "code", normalized: "EX", numericValue: null, code: "EX", error: null };
    }
    return {
      valid: false,
      kind: "invalid",
      normalized,
      numericValue: null,
      code: null,
      error: `EX is not allowed here. Enter ${allowedValues}.`,
    };
  }

  const numeric = validateScore(normalized);
  if (!numeric.valid) {
    return {
      valid: false,
      kind: "invalid",
      normalized,
      numericValue: null,
      code: null,
      error: numeric.error === `"${normalized}" is not a valid score.`
        ? `Mark "${normalized}" is not valid. Enter ${allowedValues}.`
        : numeric.error,
    };
  }

  return {
    valid: true,
    kind: "numeric",
    normalized: String(numeric.value),
    numericValue: numeric.value,
    code: null,
    error: null,
  };
}
