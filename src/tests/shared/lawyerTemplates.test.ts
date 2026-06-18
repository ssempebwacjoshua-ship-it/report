import { describe, expect, it } from "vitest";
import { getLawyerPageTemplates } from "../../shared/lawyerTemplates";

describe("lawyer template registry", () => {
  it("includes the required lawyer drafting templates", () => {
    const ids = getLawyerPageTemplates("parsed").map((template) => template.id);

    expect(ids).toEqual(expect.arrayContaining([
      "client-intake-summary",
      "legal-notice-demand-letter",
      "debt-recovery-demand-letter",
      "land-dispute-notice",
      "affidavit-draft",
      "witness-statement",
      "case-chronology",
      "contract-summary",
      "contract-risk-review",
      "court-document-summary",
      "evidence-bundle-index",
      "client-update-letter",
      "legal-opinion-draft",
    ]));
  });
});

