export type SchoolSection = "NURSERY" | "PRIMARY" | "SECONDARY";

export type CanonicalClass = {
  name: string;
  code: string;
  level: number;
  section: SchoolSection;
};

export const CANONICAL_CLASSES: readonly CanonicalClass[] = [
  // Nursery / Pre-primary
  { name: "Baby Class",   code: "BABY",   level: 1,  section: "NURSERY" },
  { name: "Middle Class", code: "MIDDLE", level: 2,  section: "NURSERY" },
  { name: "Top Class",    code: "TOP",    level: 3,  section: "NURSERY" },
  // Primary
  { name: "P1", code: "P1", level: 10, section: "PRIMARY" },
  { name: "P2", code: "P2", level: 11, section: "PRIMARY" },
  { name: "P3", code: "P3", level: 12, section: "PRIMARY" },
  { name: "P4", code: "P4", level: 13, section: "PRIMARY" },
  { name: "P5", code: "P5", level: 14, section: "PRIMARY" },
  { name: "P6", code: "P6", level: 15, section: "PRIMARY" },
  { name: "P7", code: "P7", level: 16, section: "PRIMARY" },
  // Secondary
  { name: "Senior 1", code: "S1", level: 20, section: "SECONDARY" },
  { name: "Senior 2", code: "S2", level: 21, section: "SECONDARY" },
  { name: "Senior 3", code: "S3", level: 22, section: "SECONDARY" },
  { name: "Senior 4", code: "S4", level: 23, section: "SECONDARY" },
  { name: "Senior 5", code: "S5", level: 24, section: "SECONDARY" },
  { name: "Senior 6", code: "S6", level: 25, section: "SECONDARY" },
];

export const CANONICAL_CLASS_CODES: ReadonlySet<string> = new Set(
  CANONICAL_CLASSES.map((c) => c.code),
);

export const CANONICAL_CLASSES_BY_SECTION: Record<SchoolSection, CanonicalClass[]> = {
  NURSERY:   CANONICAL_CLASSES.filter((c) => c.section === "NURSERY"),
  PRIMARY:   CANONICAL_CLASSES.filter((c) => c.section === "PRIMARY"),
  SECONDARY: CANONICAL_CLASSES.filter((c) => c.section === "SECONDARY"),
};

/** Returns true when the code matches a canonical class code (case-insensitive). */
export function isCanonicalClassCode(code: string): boolean {
  return CANONICAL_CLASS_CODES.has(code.trim().toUpperCase());
}

/** Returns the canonical class definitions for the requested sections, in level order. */
export function getClassesForSections(sections: SchoolSection[]): CanonicalClass[] {
  const sectionSet = new Set(sections);
  return CANONICAL_CLASSES.filter((c) => sectionSet.has(c.section));
}
