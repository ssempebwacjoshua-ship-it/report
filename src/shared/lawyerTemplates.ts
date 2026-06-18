import type { SmartPageTemplateContext, SmartPageTemplateDefinition, SmartPageTemplateScope } from "./smartPagesTemplates";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function stringifyPreferences(preferences: Record<string, unknown> | null | undefined): string {
  if (!preferences || Object.keys(preferences).length === 0) {
    return "No saved lawyer profile yet.";
  }

  const profile = (preferences["lawyer.profile"] as Record<string, unknown> | undefined) ?? {};
  const firm = (preferences["lawyer.firm"] as Record<string, unknown> | undefined) ?? {};
  const practiceAreas = Array.isArray(preferences["lawyer.practiceAreas"]) ? preferences["lawyer.practiceAreas"] as unknown[] : [];

  const lines = [
    `Lawyer name: ${readString(profile.name) || "Not provided"}`,
    `Firm name: ${readString(firm.name) || "Not provided"}`,
    `Firm address: ${readString(firm.address) || "Not provided"}`,
    `Phone / email: ${readString(firm.contact) || "Not provided"}`,
    `Jurisdiction: ${readString(preferences["lawyer.defaultJurisdiction"]) || "Uganda"}`,
    `City / district: ${readString(profile.location) || "Not provided"}`,
    `Practice areas: ${practiceAreas.map((area) => readString(area)).filter(Boolean).join(", ") || "Not provided"}`,
    `Preferred tone: ${readString(preferences["lawyer.tone"]) || "Formal"}`,
    `Preferred output format: ${readString(preferences["lawyer.outputStyle"]) || "Plain draft"}`,
    `Signature block: ${readString(preferences["lawyer.signatureBlock"]) || "Not provided"}`,
    `Common sign-off: ${readString(preferences["lawyer.commonSignOff"]) || "Not provided"}`,
    `Without prejudice option: ${readBoolean(preferences["lawyer.withoutPrejudice"]) ? "Yes" : "No"}`,
    `Include lawyer review disclaimer: ${readBoolean(preferences["lawyer.reviewDisclaimer"]) ? "Yes" : "No"}`,
  ];

  return lines.join("\n");
}

function buildLawyerContext(context: SmartPageTemplateContext): string {
  const knowledge = context.extractedKnowledge ?? null;
  const lines = [
    `Document title: ${context.documentTitle ?? knowledge?.title ?? "Untitled legal document"}`,
    `Detected document type: ${knowledge?.documentType ?? "document"}`,
    `Detected domain: ${knowledge?.domain ?? "legal"}`,
    `Sections found: ${knowledge?.sections?.length ?? 0}`,
    `Tables found: ${knowledge?.tables?.length ?? 0}`,
    `Unclear items: ${knowledge?.unclearItems?.length ?? 0}`,
    `Recommended next step: ${knowledge?.recommendedNextStep ?? "review"}`,
  ];

  if (typeof knowledge?.confidence === "number") {
    lines.push(`Extraction confidence: ${Math.round(knowledge.confidence * 100)}%`);
  }

  lines.push("", "Saved lawyer profile:", stringifyPreferences(context.preferences));
  return lines.join("\n");
}

function lawyerPrompt(context: SmartPageTemplateContext, instruction: string): string {
  return [
    instruction,
    "",
    "Use the parsed legal material below as the source of truth.",
    buildLawyerContext(context),
    "",
    "Prepare a lawyer-reviewable draft that stays editable before final export.",
    "Do not invent legal citations, statutes, or case law.",
    "Use placeholders such as 'Applicable law to be verified by lawyer' when the source material does not supply exact authority.",
    "Keep any output suitable for Ugandan legal practice and professional client review.",
  ].join("\n");
}

export const LAWYER_TEMPLATES: SmartPageTemplateDefinition[] = [
  {
    id: "client-intake-summary",
    name: "Client Intake Summary",
    description: "Turn client notes and intake papers into a structured matter summary.",
    category: "Document",
    scope: ["parsed"],
    inputRequirements: ["Client details", "Matter type", "Key facts", "Key dates"],
    outputSchema: ["Client details", "Matter type", "Key facts", "Key dates", "Parties", "Documents provided", "Missing documents", "Legal issues", "Next steps"],
    primaryAction: "Create",
    highlight: "Best for quickly organizing a new file.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Create a client intake summary. Capture the client details, matter type, key facts, key dates, parties involved, documents provided, missing documents, legal issues to review, and next steps.",
    ),
  },
  {
    id: "legal-notice-demand-letter",
    name: "Legal Notice / Demand Letter",
    description: "Draft a firm legal notice or demand letter with a clear deadline.",
    category: "Letter",
    scope: ["parsed"],
    inputRequirements: ["Firm header", "Recipient", "Background facts", "Deadline"],
    outputSchema: ["Firm header", "Date", "Recipient", "Subject", "Background facts", "Demand", "Deadline", "Consequences", "Without prejudice option", "Signature block"],
    primaryAction: "Create",
    highlight: "Keep it firm, clear, and lawyer-reviewable.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Draft a legal notice or demand letter. Include the firm header, date, recipient, subject, background facts, the action required, deadline, consequences of non-compliance, an optional without prejudice line if appropriate, and the lawyer signature block.",
    ),
  },
  {
    id: "debt-recovery-demand-letter",
    name: "Debt Recovery Demand Letter",
    description: "Prepare a demand letter for an unpaid debt or balance due.",
    category: "Finance",
    scope: ["parsed"],
    inputRequirements: ["Amount owed", "Basis of debt", "Deadline", "Payment instructions"],
    outputSchema: ["Amount owed", "Basis of debt", "Payment deadline", "Payment instructions", "Further action warning", "Signature block"],
    primaryAction: "Create",
    highlight: "Useful for collections and repayment follow-up.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Draft a debt recovery demand letter. State the amount owed, the basis of the debt, the payment deadline, payment instructions placeholder, a warning of further action, and the signature block. Keep the draft ready for lawyer review.",
    ),
  },
  {
    id: "land-dispute-notice",
    name: "Land Dispute Notice",
    description: "Draft a notice for a land or property dispute with supporting details.",
    category: "Letter",
    scope: ["parsed"],
    inputRequirements: ["Parties", "Property description", "Background facts", "Required action"],
    outputSchema: ["Parties", "Property description", "Background facts", "Nature of dispute", "Required action", "Supporting documents", "Deadline", "Signature block"],
    primaryAction: "Create",
    highlight: "Good for conveyancing and property disputes.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Draft a land dispute notice. Include the parties, land or property description, background facts, nature of the dispute, required action, supporting documents, deadline, and signature block.",
    ),
  },
  {
    id: "affidavit-draft",
    name: "Affidavit Draft",
    description: "Turn facts into a numbered affidavit draft with placeholders for execution.",
    category: "Document",
    scope: ["parsed"],
    inputRequirements: ["Deponent details", "Numbered facts", "Exhibits"],
    outputSchema: ["Deponent details", "Numbered paragraphs", "Jurat placeholder", "Commissioner for Oaths placeholder", "Exhibits list", "Lawyer review note"],
    primaryAction: "Create",
    highlight: "Keep the legal wording editable before swearing.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Draft an affidavit. Include the deponent details, the statement of facts in numbered paragraphs, a jurat placeholder, a Commissioner for Oaths placeholder, an exhibits list, and a lawyer review note. Do not invent facts that are not in the source material.",
    ),
  },
  {
    id: "witness-statement",
    name: "Witness Statement",
    description: "Organize witness notes into a chronological statement.",
    category: "Document",
    scope: ["parsed"],
    inputRequirements: ["Witness details", "Chronology", "Supporting facts"],
    outputSchema: ["Witness details", "Matter title", "Chronological statement", "Supporting facts", "Attachments / exhibits", "Signature / date area"],
    primaryAction: "Create",
    highlight: "Best for court preparation and evidence review.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Create a witness statement from the parsed material. Include the witness details, matter title, chronological statement, supporting facts, attachments or exhibits, and a signature and date area.",
    ),
  },
  {
    id: "case-chronology",
    name: "Case Chronology",
    description: "Build a timeline of facts, events, and missing dates.",
    category: "Planning",
    scope: ["parsed"],
    inputRequirements: ["Dates", "Events", "Source documents"],
    outputSchema: ["Date", "Event", "Source document", "Person involved", "Legal relevance", "Missing or uncertain date warnings"],
    primaryAction: "Create",
    highlight: "Helpful for litigation prep and file review.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Prepare a case chronology. Include the date, event, source document, person involved, legal relevance, and warnings for missing or uncertain dates. Keep the chronology easy to review and edit.",
    ),
  },
  {
    id: "contract-summary",
    name: "Contract Summary",
    description: "Summarize a contract into the key commercial and legal points.",
    category: "Agreement",
    scope: ["parsed"],
    inputRequirements: ["Parties", "Purpose", "Payment terms", "Termination", "Deadlines"],
    outputSchema: ["Parties", "Effective date", "Purpose", "Obligations", "Payment terms", "Termination", "Deadlines", "Risk notes", "Missing clauses"],
    primaryAction: "Create",
    highlight: "Good for fast contract review before deeper analysis.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Create a contract summary. Include the parties, effective date, purpose, obligations, payment terms, termination, deadlines, risk notes, and missing clauses. Keep the summary lawyer-reviewable.",
    ),
  },
  {
    id: "contract-risk-review",
    name: "Contract Risk Review",
    description: "Highlight risk points and missing protections in a contract.",
    category: "Report",
    scope: ["parsed"],
    inputRequirements: ["Clause text", "Risk points", "Suggested review notes"],
    outputSchema: ["Clause", "Risk level", "Why it matters", "Suggested lawyer review", "Missing provisions", "Client-friendly explanation"],
    primaryAction: "Create",
    highlight: "Useful for client advice notes and partner review.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Review the contract for risk. For each clause, describe the risk level, why it matters, the suggested lawyer review, missing provisions, and a client-friendly explanation. Do not give final legal advice; mark anything that must be verified by the lawyer.",
    ),
  },
  {
    id: "court-document-summary",
    name: "Court Document Summary",
    description: "Summarize court papers into a practical case tracker.",
    category: "Report",
    scope: ["parsed"],
    inputRequirements: ["Court name", "Case number", "Orders or ruling", "Key dates"],
    outputSchema: ["Court name", "Case number", "Parties", "Document type", "Orders sought / ruling outcome", "Key dates", "Next action", "Missing details"],
    primaryAction: "Create",
    highlight: "Good for pleadings, orders, and filing follow-up.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Summarize the court document. Include the court name, case number, parties, document type, orders sought or ruling outcome, key dates, next action, and any missing details. Keep it clear and lawyer-reviewable.",
    ),
  },
  {
    id: "evidence-bundle-index",
    name: "Evidence Bundle Index",
    description: "Create an index of exhibits and supporting documents.",
    category: "Table",
    scope: ["parsed"],
    inputRequirements: ["Exhibits", "Document dates", "Sources", "Notes"],
    outputSchema: ["Exhibit number", "Document name", "Date", "Source", "Relevance", "Notes", "Missing documents"],
    primaryAction: "Create",
    highlight: "Useful for bundles, court filing, and case prep.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Build an evidence bundle index. Include exhibit number, document name, date, source, relevance, notes, and missing documents. Keep the index editable and suitable for final review.",
    ),
  },
  {
    id: "client-update-letter",
    name: "Client Update Letter",
    description: "Draft a progress update for the client in plain professional language.",
    category: "Letter",
    scope: ["parsed"],
    inputRequirements: ["Matter summary", "Work done", "Pending action", "Next deadline"],
    outputSchema: ["Matter summary", "Work done", "Current status", "Pending action", "Documents needed", "Next appointment or deadline", "Signature block"],
    primaryAction: "Create",
    highlight: "Good for keeping clients informed without overpromising.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Draft a client update letter. Include the matter summary, work done, current status, pending action, documents needed, next appointment or deadline, and the signature block. Keep the tone professional and client-friendly.",
    ),
  },
  {
    id: "legal-opinion-draft",
    name: "Legal Opinion Draft",
    description: "Structure a legal opinion with placeholders for verified law and analysis.",
    category: "Report",
    scope: ["parsed"],
    inputRequirements: ["Background", "Facts relied on", "Issues for consideration"],
    outputSchema: ["Background", "Issues for consideration", "Facts relied on", "Analysis placeholders", "Recommendation", "Verification caveat"],
    primaryAction: "Create",
    highlight: "Always leave room for final legal verification.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Prepare a legal opinion draft. Include the background, issues for consideration, facts relied on, analysis placeholders, recommendation, and a caveat that applicable law, procedure, and citations must be verified by the lawyer. Do not invent legal authority.",
    ),
  },
];

export function getLawyerPageTemplates(scope: SmartPageTemplateScope): SmartPageTemplateDefinition[] {
  return LAWYER_TEMPLATES.filter((template) => template.scope.includes(scope));
}

export function getLawyerPageTemplateById(templateId: string): SmartPageTemplateDefinition | undefined {
  return LAWYER_TEMPLATES.find((template) => template.id === templateId);
}

