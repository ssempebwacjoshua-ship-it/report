import { describe, expect, it } from "vitest";
import { buildLawyerTemplateStarterDraft, getLawyerPageTemplates } from "../../shared/lawyerTemplates";
import { getSmartPageTemplates } from "../../shared/smartPagesTemplates";

describe("lawyer template registry", () => {
  it("includes the required lawyer drafting templates", () => {
    const ids = getLawyerPageTemplates("parsed").map((template) => template.id);

    expect(ids).toEqual(expect.arrayContaining([
      "client-intake-summary",
      "legal-notice-demand-letter",
      "affidavit-statutory-declaration",
      "legal-opinion",
      "contract-draft",
      "contract-review-memo",
      "case-brief-matter-summary",
      "letter-to-client",
      "witness-statement",
      "settlement-agreement-mou",
    ]));
  });

  it("keeps lawyer templates out of the school Smart Pages registry", () => {
    const lawyerIds = getLawyerPageTemplates("parsed").map((template) => template.id);
    const schoolIds = getSmartPageTemplates("parsed").map((template) => template.id);

    expect(schoolIds).not.toEqual(expect.arrayContaining(lawyerIds));
    expect(getLawyerPageTemplates("parsed").every((template) => template.vertical === "LAWYER")).toBe(true);
    expect(getSmartPageTemplates("parsed").every((template) => template.vertical === "SCHOOL")).toBe(true);
  });

  it("builds a useful starter draft outline for lawyers", () => {
    const template = getLawyerPageTemplates("parsed").find((item) => item.id === "legal-notice-demand-letter");
    expect(template).toBeDefined();

    const draft = buildLawyerTemplateStarterDraft(template!, "Acacia Legal Notice");
    expect(draft).toContain("Acacia Legal Notice");
    expect(draft).toContain("Muwanga & Co. Advocates");
    expect(draft).toContain("Pearl Office Supplies Ltd");
    expect(draft).toContain("Kato Builders Ltd");
    expect(draft).toContain("UGX 12,500,000");
    expect(draft).toContain("7 days");
    expect(draft).toContain("Counsel Daniel Muwanga");
    expect(draft).toContain("We act for Pearl Office Supplies Ltd.");
    expect(draft).toContain("Review required: Generated documents are drafts and must be reviewed by a qualified legal professional before use.");
    expect(draft).toContain("Parties:");
  });
});

