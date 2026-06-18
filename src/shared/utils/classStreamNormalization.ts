import { CANONICAL_CLASSES, type CanonicalClass } from "../constants/classes";

const WORD_NUMBERS: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
};

function normalizeLookup(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b(one|two|three|four|five|six)\b/g, (word) => WORD_NUMBERS[word] ?? word)
    .replace(/[^a-z0-9]+/g, "");
}

function titleCaseToken(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-z]$/i.test(trimmed)) return trimmed.toUpperCase();
  return trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token[0]!.toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

function classAliases(def: CanonicalClass) {
  const compactName = def.name.replace(/\s+/g, "");
  const aliases = new Set<string>([def.code, def.name, compactName, compactName.toLowerCase(), def.code.toLowerCase()]);
  if (def.section === "PRIMARY" && /^P\d+$/.test(def.code)) {
    const number = def.code.slice(1);
    aliases.add(`Primary ${number}`);
    aliases.add(`Primary${number}`);
  }
  if (def.section === "SECONDARY" && /^S\d+$/.test(def.code)) {
    const number = def.code.slice(1);
    aliases.add(`Senior ${number}`);
    aliases.add(`Senior${number}`);
  }
  return [...aliases];
}

function resolveCanonicalClassMatch(value: string): { classDef: CanonicalClass; remainder: string } | null {
  const lookup = normalizeLookup(value);
  if (!lookup) return null;

  const ordered = CANONICAL_CLASSES
    .map((classDef) => ({
      classDef,
      aliases: classAliases(classDef).sort((a, b) => b.length - a.length),
    }))
    .sort((a, b) => Math.max(...b.aliases.map((alias) => alias.length)) - Math.max(...a.aliases.map((alias) => alias.length)));

  for (const item of ordered) {
    for (const alias of item.aliases) {
      const normalizedAlias = normalizeLookup(alias);
      if (!normalizedAlias) continue;
      if (lookup === normalizedAlias) return { classDef: item.classDef, remainder: "" };
      if (lookup.startsWith(normalizedAlias)) {
        return { classDef: item.classDef, remainder: lookup.slice(normalizedAlias.length) };
      }
    }
  }

  return null;
}

function normalizeStreamSuffix(value: string) {
  const compact = normalizeLookup(value).replace(/^(stream|class|section)+/, "");
  if (!compact) return "";
  return titleCaseToken(compact);
}

export type ClassStreamNormalization = {
  className: string;
  classCode: string;
  streamName: string;
  streamCode: string;
  combinedInput: boolean;
};

export function resolveCanonicalClassFromInput(value: string): CanonicalClass | null {
  return resolveCanonicalClassMatch(value)?.classDef ?? null;
}

export function resolveCanonicalClassAndStreamInput(
  className: string,
  streamName: string,
): ClassStreamNormalization | null {
  const trimmedClass = className.trim();
  const classMatch = resolveCanonicalClassMatch(trimmedClass);
  if (!classMatch) return null;

  const explicitStream = streamName.trim();
  const derivedStream = explicitStream || normalizeStreamSuffix(classMatch.remainder);

  return {
    className: classMatch.classDef.name,
    classCode: classMatch.classDef.code,
    streamName: derivedStream,
    streamCode: normalizeLookup(derivedStream).replace(/^(stream|class|section)+/, "").toUpperCase(),
    combinedInput: !explicitStream && Boolean(classMatch.remainder),
  };
}

export function parseLegacyCombinedClassCode(
  value: string,
): { parentCode: string; streamSuffix: string } | null {
  const classMatch = resolveCanonicalClassMatch(value);
  if (!classMatch?.remainder) return null;

  return {
    parentCode: classMatch.classDef.code,
    streamSuffix: normalizeStreamSuffix(classMatch.remainder),
  };
}

