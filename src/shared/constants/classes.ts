export type SchoolSection = "NURSERY" | "PRIMARY" | "SECONDARY" | "COMBINED";

export type CanonicalClass = {
  name: string;
  code: string;
  level: number;
  section: Exclude<SchoolSection, "COMBINED">;
};

export const CANONICAL_CLASSES: readonly CanonicalClass[] = [
  { name: "Baby Class", code: "NUR_BABY", level: 1, section: "NURSERY" },
  { name: "Middle Class", code: "NUR_MIDDLE", level: 2, section: "NURSERY" },
  { name: "Top Class", code: "NUR_TOP", level: 3, section: "NURSERY" },
  { name: "Primary 1", code: "P1", level: 10, section: "PRIMARY" },
  { name: "Primary 2", code: "P2", level: 11, section: "PRIMARY" },
  { name: "Primary 3", code: "P3", level: 12, section: "PRIMARY" },
  { name: "Primary 4", code: "P4", level: 13, section: "PRIMARY" },
  { name: "Primary 5", code: "P5", level: 14, section: "PRIMARY" },
  { name: "Primary 6", code: "P6", level: 15, section: "PRIMARY" },
  { name: "Primary 7", code: "P7", level: 16, section: "PRIMARY" },
  { name: "Senior 1", code: "S1", level: 20, section: "SECONDARY" },
  { name: "Senior 2", code: "S2", level: 21, section: "SECONDARY" },
  { name: "Senior 3", code: "S3", level: 22, section: "SECONDARY" },
  { name: "Senior 4", code: "S4", level: 23, section: "SECONDARY" },
  { name: "Senior 5", code: "S5", level: 24, section: "SECONDARY" },
  { name: "Senior 6", code: "S6", level: 25, section: "SECONDARY" },
];

export const CANONICAL_CLASS_CODES: ReadonlySet<string> = new Set(
  CANONICAL_CLASSES.map((klass) => klass.code),
);

const INSTRUCTIONAL_SECTIONS = ["NURSERY", "PRIMARY", "SECONDARY"] as const;
export type InstructionalSection = (typeof INSTRUCTIONAL_SECTIONS)[number];

export function expandSchoolSections(sections: SchoolSection[]): InstructionalSection[] {
  const expanded = new Set<InstructionalSection>();
  for (const section of sections) {
    if (section === "COMBINED") {
      expanded.add("PRIMARY");
      expanded.add("SECONDARY");
      continue;
    }
    expanded.add(section);
  }
  return INSTRUCTIONAL_SECTIONS.filter((section) => expanded.has(section));
}

export const CANONICAL_CLASSES_BY_SECTION: Record<InstructionalSection, CanonicalClass[]> = {
  NURSERY: CANONICAL_CLASSES.filter((klass) => klass.section === "NURSERY"),
  PRIMARY: CANONICAL_CLASSES.filter((klass) => klass.section === "PRIMARY"),
  SECONDARY: CANONICAL_CLASSES.filter((klass) => klass.section === "SECONDARY"),
};

export function isCanonicalClassCode(code: string): boolean {
  return CANONICAL_CLASS_CODES.has(code.trim().toUpperCase());
}

export function getClassesForSections(sections: SchoolSection[]): CanonicalClass[] {
  const sectionSet = new Set(expandSchoolSections(sections));
  return CANONICAL_CLASSES.filter((klass) => sectionSet.has(klass.section));
}
