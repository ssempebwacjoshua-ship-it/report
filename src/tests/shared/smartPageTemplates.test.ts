import { describe, expect, it } from "vitest";
import { SMART_PAGE_TEMPLATES, SUMMARY_STYLES, getSmartPageTemplates } from "../../shared/smartPagesTemplates";

describe("smartPageTemplates", () => {
  it("exposes the parsed document processing templates", () => {
    const parsed = getSmartPageTemplates("parsed").map((template) => template.name);

    expect(parsed).toEqual(
      expect.arrayContaining([
        "Clean & Rebuild Document",
        "Create Editable Smart Page",
        "Summarize Document",
        "Extract to Table",
        "Rebuild as Form",
        "Create Formal Letter",
        "Create Report",
        "Generate Meeting Minutes",
        "Create Action Plan",
        "Create Agreement",
        "Create Invoice / Receipt",
      ]),
    );
  });

  it("exposes the delivery and bulk templates", () => {
    const ready = getSmartPageTemplates("ready").map((template) => template.name);
    const bulk = getSmartPageTemplates("bulk").map((template) => template.name);

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
    expect(SMART_PAGE_TEMPLATES.every((template) => template.inputRequirements.length > 0)).toBe(true);
    expect(SMART_PAGE_TEMPLATES.every((template) => template.outputSchema.length > 0)).toBe(true);
    expect(SMART_PAGE_TEMPLATES.every((template) => typeof template.buildPrompt === "function")).toBe(true);
  });
});
