import { describe, expect, it } from "vitest";
import {
  SCHOOL_TEMPLATE_BLOCKED_TERMS,
  SMART_PAGE_TEMPLATES,
  SUMMARY_STYLES,
  getSmartPageTemplates,
  searchSmartPageTemplates,
} from "../../shared/smartPagesTemplates";

const REQUIRED_SCHOOL_TEMPLATE_NAMES = [
  "Clean & Rebuild Document",
  "Create Editable Smart Page",
  "Summarize Document",
  "Extract to Table",
  "Rebuild as Form",
  "School Notice",
  "School Circular",
  "School Programme",
  "Timetable",
  "Exam Schedule",
  "Meeting Minutes",
  "Action Plan",
  "Letter to Parents",
  "Permission Slip",
  "Student List",
  "Attendance Sheet",
  "Report",
  "Invoice / Receipt",
  "Publish Secure Link",
  "Generate in Bulk",
];

describe("smartPageTemplates", () => {
  it("exposes only school templates in the school Smart Pages registry", () => {
    const templates = [
      ...getSmartPageTemplates("parsed", "SCHOOL"),
      ...getSmartPageTemplates("ready", "SCHOOL"),
      ...getSmartPageTemplates("bulk", "SCHOOL"),
    ];
    const names = templates.map((template) => template.name);

    expect(names).toEqual(expect.arrayContaining(REQUIRED_SCHOOL_TEMPLATE_NAMES));
    expect(templates.every((template) => template.vertical === "SCHOOL")).toBe(true);
    expect(templates.every((template) => template.isActive)).toBe(true);
  });

  it("contains zero lawyer templates in the school template list", () => {
    const schoolTemplates = [
      ...getSmartPageTemplates("parsed", "SCHOOL"),
      ...getSmartPageTemplates("ready", "SCHOOL"),
      ...getSmartPageTemplates("bulk", "SCHOOL"),
    ];

    expect(schoolTemplates).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ vertical: "LAWYER" }),
    ]));
  });

  it("does not include lawyer terms in the school prompt registry", () => {
    const promptText = SMART_PAGE_TEMPLATES
      .filter((template) => template.vertical === "SCHOOL")
      .map((template) => template.buildPrompt({
        documentTitle: "School document",
        extractedKnowledge: {
          documentType: "notice",
          domain: "education",
          title: "School document",
          suggestedDocumentType: "notice",
          sections: [],
          tables: [],
          statistics: [],
          entities: [],
          people: [],
          dates: [],
          handwrittenNotes: [],
          keyFacts: [],
          unclearItems: [],
          rawText: "",
        },
      }))
      .join("\n")
      .toLowerCase();

    for (const term of SCHOOL_TEMPLATE_BLOCKED_TERMS) {
      expect(promptText).not.toContain(term);
    }
    expect(promptText).toContain("you are processing a school document for school connect smart pages.");
  });

  it("returns no school template search results for legal vertical terms", () => {
    for (const term of SCHOOL_TEMPLATE_BLOCKED_TERMS) {
      expect(searchSmartPageTemplates(term, undefined, "SCHOOL")).toHaveLength(0);
    }
  });

  it("exposes the delivery and bulk templates", () => {
    const ready = getSmartPageTemplates("ready", "SCHOOL").map((template) => template.name);
    const bulk = getSmartPageTemplates("bulk", "SCHOOL").map((template) => template.name);

    expect(ready).toContain("Publish Secure Link");
    expect(bulk).toContain("Generate in Bulk");
  });

  it("includes summary styles for the summary template", () => {
    expect(SUMMARY_STYLES).toHaveLength(4);
    expect(SUMMARY_STYLES.map((style) => style.name)).toEqual(
      expect.arrayContaining([
        "Short summary",
        "Executive summary",
        "Bullet summary",
        "Simple-language summary",
      ]),
    );
  });

  it("keeps template metadata populated for the picker", () => {
    expect(SMART_PAGE_TEMPLATES.every((template) => template.id)).toBe(true);
    expect(SMART_PAGE_TEMPLATES.every((template) => template.name)).toBe(true);
    expect(SMART_PAGE_TEMPLATES.every((template) => template.description)).toBe(true);
    expect(SMART_PAGE_TEMPLATES.every((template) => template.vertical)).toBe(true);
    expect(SMART_PAGE_TEMPLATES.every((template) => template.category)).toBe(true);
    expect(SMART_PAGE_TEMPLATES.every((template) => typeof template.isActive === "boolean")).toBe(true);
    expect(SMART_PAGE_TEMPLATES.every((template) => template.inputRequirements.length > 0)).toBe(true);
    expect(SMART_PAGE_TEMPLATES.every((template) => template.outputSchema.length > 0)).toBe(true);
    expect(SMART_PAGE_TEMPLATES.every((template) => typeof template.buildPrompt === "function")).toBe(true);
  });
});
