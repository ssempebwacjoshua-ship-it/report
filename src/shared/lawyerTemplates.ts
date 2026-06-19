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

function buildStarterSections(template: SmartPageTemplateDefinition): string[] {
  return template.outputSchema.map((section) => `${section}:`);
}

export function buildLawyerTemplateStarterDraft(
  template: SmartPageTemplateDefinition,
  documentTitle?: string | null,
): string {
  if (template.id === "legal-notice-demand-letter") {
    return [
      documentTitle?.trim() || template.name,
      "",
      "Muwanga & Co. Advocates",
      "Counsel Daniel Muwanga",
      "",
      "Re: Legal Notice / Demand Letter",
      "To: Pearl Office Supplies Ltd",
      "Attention: Managing Director",
      "",
      "We act for Pearl Office Supplies Ltd.",
      "Our client supplied office furniture valued at UGX 12,500,000 to Kato Builders Ltd.",
      "Despite repeated requests, the amount remains unpaid.",
      "",
      "You are hereby given 7 days to settle the full amount of UGX 12,500,000.",
      "If payment is not received within the deadline, our client will take further legal action without further notice.",
      "",
      "Yours faithfully,",
      "Counsel Daniel Muwanga",
      "",
      "Draft outline:",
      "Parties:",
      "Background:",
      "Demand:",
      "Deadline:",
      "Consequences:",
      "Signature block:",
      "",
      "Review required: Generated documents are drafts and must be reviewed by a qualified legal professional before use.",
    ].join("\n");
  }

  return [
    documentTitle?.trim() || template.name,
    "",
    `Template: ${template.name}`,
    `Category: ${template.category}`,
    `Purpose: ${template.description}`,
    "",
    "Draft outline:",
    ...buildStarterSections(template),
    "",
    "Inputs to confirm:",
    ...template.inputRequirements.map((item) => `- ${item}`),
    "",
    "Review required: Generated documents are drafts and must be reviewed by a qualified legal professional before use.",
  ].join("\n");
}

export const LAWYER_TEMPLATES: SmartPageTemplateDefinition[] = [
  {
    id: "client-intake-summary",
    name: "Client Intake Summary",
    description: "Turn client notes into a structured matter summary.",
    category: "Document",
    scope: ["parsed"],
    inputRequirements: ["Client details", "Opposing party", "Facts", "Issue", "Requested remedy", "Next steps"],
    outputSchema: ["Client details", "Opposing party", "Facts", "Issue", "Requested remedy", "Next steps", "Missing information"],
    primaryAction: "Create",
    highlight: "Best for opening a new file and capturing the essentials quickly.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Create a client intake summary. Capture the client details, opposing party, facts, issue, requested remedy, next steps, and missing information. Keep the draft clear, editable, and ready for lawyer review.",
    ),
  },
  {
    id: "legal-notice-demand-letter",
    name: "Legal Notice / Demand Letter",
    description: "Draft a professional demand notice with a clear deadline.",
    category: "Letter",
    scope: ["parsed"],
    inputRequirements: ["Parties", "Background facts", "Breach or complaint", "Deadline", "Consequences"],
    outputSchema: ["Parties", "Background", "Breach or complaint", "Demand", "Deadline", "Consequences", "Signature block"],
    primaryAction: "Create",
    highlight: "Keep the wording firm, professional, and reviewable.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Draft a legal notice or demand letter. Include the parties, background facts, breach or complaint, the demand, deadline, consequences of non-compliance, and a signature block. Use professional Ugandan legal drafting and keep placeholders where facts are missing.",
    ),
  },
  {
    id: "affidavit-statutory-declaration",
    name: "Affidavit / Statutory Declaration",
    description: "Structure a sworn statement draft with execution placeholders.",
    category: "Document",
    scope: ["parsed"],
    inputRequirements: ["Deponent details", "Facts", "Exhibits", "Oath or declaration choice"],
    outputSchema: ["Deponent details", "Facts", "Exhibits", "Oath / declaration text", "Commissioner area", "Signature block"],
    primaryAction: "Create",
    highlight: "Ready for lawyer review before swearing or declaration.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Draft an affidavit or statutory declaration. Include the deponent details, the facts to be sworn, any exhibits, the oath or declaration text, a Commissioner for Oaths area, and the signature block. Do not invent facts and keep the document editable for review.",
    ),
  },
  {
    id: "legal-opinion",
    name: "Legal Opinion",
    description: "Create a lawyer opinion memo with verified-law placeholders.",
    category: "Report",
    scope: ["parsed"],
    inputRequirements: ["Question presented", "Facts", "Issues", "Relevant law", "Risks"],
    outputSchema: ["Question presented", "Facts", "Issues", "Applicable law placeholder", "Analysis", "Risks", "Conclusion", "Recommendation"],
    primaryAction: "Create",
    highlight: "Always leave room for final legal verification.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Prepare a legal opinion. Include the question presented, facts, issues, an applicable law placeholder, analysis, risks, conclusion, and recommendation. Do not invent citations or legal authority; mark anything that must be verified by the lawyer.",
    ),
  },
  {
    id: "contract-draft",
    name: "Contract Draft",
    description: "Build a practical agreement draft with standard deal terms.",
    category: "Agreement",
    scope: ["parsed"],
    inputRequirements: ["Parties", "Purpose", "Payment", "Duration", "Termination"],
    outputSchema: ["Parties", "Recitals / background", "Obligations", "Payment", "Duration", "Termination", "Confidentiality", "Dispute resolution", "Signatures"],
    primaryAction: "Create",
    highlight: "Good for drafting a fresh agreement from rough notes.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Draft a contract. Include the parties, recitals or background, obligations, payment terms, duration, termination, confidentiality, dispute resolution, and signature blocks. Keep the draft editable and ready for lawyer review.",
    ),
  },
  {
    id: "contract-review-memo",
    name: "Contract Review Memo",
    description: "Review uploaded contract text and flag risk points for the lawyer.",
    category: "Report",
    scope: ["parsed"],
    inputRequirements: ["Contract text", "Key clauses", "Client objectives"],
    outputSchema: ["Summary", "Key obligations", "Risky clauses", "Missing clauses", "Recommended edits", "Negotiation notes"],
    primaryAction: "Create",
    highlight: "Useful for client advice notes and partner review.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Review the contract and prepare a review memo. Include the summary, key obligations, risky clauses, missing clauses, recommended edits, and negotiation notes. Use drafting language and mark anything that must be verified by the lawyer before use.",
    ),
  },
  {
    id: "case-brief-matter-summary",
    name: "Case Brief / Matter Summary",
    description: "Build an internal litigation brief or matter tracker.",
    category: "Summary",
    scope: ["parsed"],
    inputRequirements: ["Facts", "Procedural posture", "Issues", "Evidence"],
    outputSchema: ["Facts", "Procedural posture", "Issues", "Evidence", "Strengths", "Weaknesses", "Next action"],
    primaryAction: "Create",
    highlight: "Helpful for litigation prep and file review.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Create a case brief or matter summary. Include the facts, procedural posture, issues, evidence, strengths, weaknesses, and next action. Keep the summary practical for lawyer review and file planning.",
    ),
  },
  {
    id: "letter-to-client",
    name: "Letter to Client",
    description: "Write a professional client update or advice letter.",
    category: "Letter",
    scope: ["parsed"],
    inputRequirements: ["Matter reference", "Update", "Advice", "Client action"],
    outputSchema: ["Greeting", "Matter reference", "Update", "Advice", "Required client action", "Closing"],
    primaryAction: "Create",
    highlight: "Good for clear client communication after review.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Draft a letter to the client. Include the greeting, matter reference, update, advice, any required client action, and a closing. Keep the tone professional, concise, and lawyer-reviewable.",
    ),
  },
  {
    id: "witness-statement",
    name: "Witness Statement",
    description: "Turn witness notes into a structured chronological statement.",
    category: "Document",
    scope: ["parsed"],
    inputRequirements: ["Witness details", "Relationship to matter", "Chronological facts", "Documents referenced"],
    outputSchema: ["Witness details", "Relationship to matter", "Chronological facts", "Documents referenced", "Declaration"],
    primaryAction: "Create",
    highlight: "Best for court preparation and evidence review.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Create a witness statement. Include the witness details, relationship to the matter, chronological facts, documents referenced, and a declaration section. Keep the statement editable and ready for lawyer review.",
    ),
  },
  {
    id: "settlement-agreement-mou",
    name: "Settlement Agreement / MoU",
    description: "Draft a settlement agreement or memorandum of understanding.",
    category: "Agreement",
    scope: ["parsed"],
    inputRequirements: ["Parties", "Background", "Settlement terms", "Payment or obligations", "Release"],
    outputSchema: ["Parties", "Background", "Settlement terms", "Payment / obligations", "Release", "Confidentiality", "Default", "Signatures"],
    primaryAction: "Create",
    highlight: "Useful for negotiated resolutions and practical handover.",
    buildPrompt: (context) => lawyerPrompt(
      context,
      "Draft a settlement agreement or memorandum of understanding. Include the parties, background, settlement terms, payment or obligations, release, confidentiality, default, and signature blocks. Keep the draft clear and ready for lawyer review.",
    ),
  },
];

export function getLawyerPageTemplates(scope: SmartPageTemplateScope): SmartPageTemplateDefinition[] {
  return LAWYER_TEMPLATES.filter((template) => template.scope.includes(scope));
}

export function getLawyerPageTemplateById(templateId: string): SmartPageTemplateDefinition | undefined {
  return LAWYER_TEMPLATES.find((template) => template.id === templateId);
}

