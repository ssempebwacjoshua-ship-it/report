import type { SchoolSection } from "./classes";

export type DefaultSubject = {
  code: string;
  name: string;
};

export const NURSERY_SUBJECTS: readonly DefaultSubject[] = [
  { code: "LITCY", name: "Literacy" },
  { code: "NUM", name: "Numeracy" },
  { code: "CREATIVE", name: "Creative Work" },
  { code: "PHYDEV", name: "Physical Development" },
  { code: "LANGDEV", name: "Language Development" },
  { code: "ENVACT", name: "Environmental Activities" },
] as const;

export const PRIMARY_SUBJECTS: readonly DefaultSubject[] = [
  { code: "ENG", name: "English" },
  { code: "MATH", name: "Mathematics" },
  { code: "SCI", name: "Science" },
  { code: "SST", name: "Social Studies" },
  { code: "RE", name: "Religious Education" },
  { code: "LOCAL", name: "Local Language" },
  { code: "CA", name: "Creative Arts" },
  { code: "PE", name: "Physical Education" },
] as const;

export const O_LEVEL_SUBJECTS: readonly DefaultSubject[] = [
  { code: "ENG", name: "English" },
  { code: "MATH", name: "Mathematics" },
  { code: "BIO", name: "Biology" },
  { code: "CHEM", name: "Chemistry" },
  { code: "PHY", name: "Physics" },
  { code: "GEO", name: "Geography" },
  { code: "HIST", name: "History" },
  { code: "CREIRE", name: "CRE/IRE" },
  { code: "ENT", name: "Entrepreneurship" },
  { code: "COMP", name: "Computer Studies" },
  { code: "AGR", name: "Agriculture" },
  { code: "KIS", name: "Kiswahili" },
] as const;

export const A_LEVEL_SUBJECTS: readonly DefaultSubject[] = [
  { code: "GP", name: "General Paper" },
  { code: "MATH", name: "Mathematics" },
  { code: "PHY", name: "Physics" },
  { code: "CHEM", name: "Chemistry" },
  { code: "BIO", name: "Biology" },
  { code: "ECON", name: "Economics" },
  { code: "GEO", name: "Geography" },
  { code: "HIST", name: "History" },
  { code: "LIT", name: "Literature" },
  { code: "ENT", name: "Entrepreneurship" },
  { code: "ICT", name: "ICT" },
  { code: "DIVIRE", name: "Divinity/IRE" },
] as const;

export function getDefaultSubjectsForSections(
  sections: SchoolSection[],
  classCodes: string[] = [],
): DefaultSubject[] {
  const normalizedSections = new Set(sections);
  const normalizedClassCodes = new Set(classCodes.map((code) => code.trim().toUpperCase()));
  const subjects: DefaultSubject[] = [];

  if (normalizedSections.has("NURSERY")) subjects.push(...NURSERY_SUBJECTS);
  if (normalizedSections.has("PRIMARY")) subjects.push(...PRIMARY_SUBJECTS);
  if (normalizedSections.has("SECONDARY")) subjects.push(...O_LEVEL_SUBJECTS);
  if (normalizedClassCodes.has("S5") || normalizedClassCodes.has("S6")) subjects.push(...A_LEVEL_SUBJECTS);

  const seen = new Set<string>();
  return subjects.filter((subject) => {
    const key = `${subject.code.toUpperCase()}|${subject.name.toUpperCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
