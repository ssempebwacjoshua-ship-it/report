import type { ExtractedKnowledge } from "./types/documentIntelligence";

export type SmartPageTemplateScope = "parsed" | "ready" | "bulk";

export type SmartPageTemplateCategory =
  | "Document"
  | "Summary"
  | "Table"
  | "Form"
  | "Letter"
  | "Report"
  | "Meetings"
  | "Planning"
  | "Agreement"
  | "Finance"
  | "Delivery"
  | "Bulk";

export type SmartPageTemplatePrimaryAction = "Create" | "Summarize" | "Publish" | "Generate";

export type SmartPageTemplateContext = {
  documentTitle?: string | null;
  extractedKnowledge?: ExtractedKnowledge | null;
  collectionName?: string | null;
  recordCount?: number | null;
  summaryStyleId?: string | null;
};

export type SmartPageTemplateDefinition = {
  id: string;
  name: string;
  description: string;
  category: SmartPageTemplateCategory;
  scope: SmartPageTemplateScope[];
  inputRequirements: string[];
  outputSchema: string[];
  primaryAction: SmartPageTemplatePrimaryAction;
  buildPrompt: (context: SmartPageTemplateContext) => string;
  highlight?: string;
};

export type SummaryStyle = {
  id: string;
  name: string;
  description: string;
  prompt: string;
};

export const SUMMARY_STYLES: SummaryStyle[] = [
  {
    id: "short",
    name: "Short summary",
    description: "A concise version that keeps only the essentials.",
    prompt: "Write a short summary that captures the most important points in 3 to 5 crisp bullets.",
  },
  {
    id: "executive",
    name: "Executive summary",
    description: "A polished overview for school leadership or management.",
    prompt: "Write an executive summary with a clear overview, key findings, implications, and action points.",
  },
  {
    id: "bullet",
    name: "Bullet summary",
    description: "A scannable list of the main ideas and takeaways.",
    prompt: "Write a bullet summary with clear headings and compact bullet points.",
  },
  {
    id: "simple",
    name: "Simple-language summary",
    description: "A plain-language version that is easy for anyone to read.",
    prompt: "Rewrite the content in simple language that is easy to understand, avoiding jargon.",
  },
];

function buildContextSummary(context: SmartPageTemplateContext): string {
  const knowledge = context.extractedKnowledge ?? null;
  const lines = [
    `Document title: ${context.documentTitle ?? knowledge?.title ?? "Untitled document"}`,
    `Detected document type: ${knowledge?.documentType ?? "document"}`,
    `Detected domain: ${knowledge?.domain ?? "general"}`,
    `Sections found: ${knowledge?.sections?.length ?? 0}`,
    `Tables found: ${knowledge?.tables?.length ?? 0}`,
    `Unclear items: ${knowledge?.unclearItems?.length ?? 0}`,
    `Recommended next step: ${knowledge?.recommendedNextStep ?? "review"}`,
  ];
  if (typeof knowledge?.confidence === "number") {
    lines.push(`Extraction confidence: ${Math.round(knowledge.confidence * 100)}%`);
  }
  if (context.collectionName) {
    lines.push(`Collection: ${context.collectionName}`);
  }
  if (typeof context.recordCount === "number") {
    lines.push(`Records available: ${context.recordCount}`);
  }
  return lines.join("\n");
}

function buildDocumentPrompt(context: SmartPageTemplateContext, instruction: string): string {
  return [
    instruction,
    "",
    "Use the parsed content below as the source of truth.",
    buildContextSummary(context),
    "",
    "Make the output editable, polished, and ready for in-app preview before print or download.",
  ].join("\n");
}

function buildSummaryPrompt(context: SmartPageTemplateContext): string {
  const style = SUMMARY_STYLES.find((item) => item.id === context.summaryStyleId) ?? SUMMARY_STYLES[0];
  return [
    "Summarize the parsed document.",
    `Style: ${style.name}. ${style.prompt}`,
    "",
    "Use the parsed content below as the source of truth.",
    buildContextSummary(context),
    "",
    "Return a clean, editable summary with a clear structure.",
  ].join("\n");
}

function buildBulkPrompt(context: SmartPageTemplateContext): string {
  return [
    "Generate many documents from the selected collection using one consistent template.",
    "Keep each generated document editable and track output status for every record.",
    "",
    "Use the collection context below.",
    buildContextSummary(context),
  ].join("\n");
}

export const SMART_PAGE_TEMPLATES: SmartPageTemplateDefinition[] = [
  {
    id: "clean-rebuild-document",
    name: "Clean & Rebuild Document",
    description: "Recreate the parsed document as a clean professional document while preserving meaning and structure.",
    category: "Document",
    scope: ["parsed"],
    inputRequirements: ["Parsed text", "Sections", "Tables where available"],
    outputSchema: ["Editable headings", "Rebuilt body text", "Structured tables", "Printable layout"],
    primaryAction: "Create",
    highlight: "Best for keeping the original layout idea while making it polished.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Recreate the parsed document as a clean professional document. Preserve meaning and structure. Fix spelling, spacing, and grammar. Rebuild tables where possible. Keep the output editable and ready for print or download.",
    ),
  },
  {
    id: "editable-smart-page",
    name: "Create Editable Smart Page",
    description: "Convert parsed content into an editable Smart Page with sections, fields, and tables.",
    category: "Document",
    scope: ["parsed"],
    inputRequirements: ["Parsed text", "Detected sections", "Detected tables"],
    outputSchema: ["Editable sections", "Editable fields", "Editable tables", "Version history ready"],
    primaryAction: "Create",
    highlight: "Best for documents that will keep changing after import.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Convert the parsed content into an editable Smart Page. Organize it into clear sections, fields, and tables that can be edited later. Keep the structure clean and suitable for in-app preview, version history, and print or download.",
    ),
  },
  {
    id: "summarize-document",
    name: "Summarize Document",
    description: "Turn the parsed content into a clear summary with a style that fits the reader.",
    category: "Summary",
    scope: ["parsed"],
    inputRequirements: ["Parsed text", "Sections", "Key facts"],
    outputSchema: ["Summary title", "Key points", "Action items where relevant"],
    primaryAction: "Summarize",
    highlight: "Choose the summary style before creating the output.",
    buildPrompt: (context) => buildSummaryPrompt(context),
  },
  {
    id: "extract-to-table",
    name: "Extract to Table",
    description: "Convert parsed rows, lists, or tables into structured table data.",
    category: "Table",
    scope: ["parsed"],
    inputRequirements: ["Parsed rows", "Lists", "Detected table cells"],
    outputSchema: ["Editable rows", "Editable columns", "Unclear values marked", "CSV/Excel ready"],
    primaryAction: "Create",
    highlight: "Best for spreadsheets, registers, and school record tables.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Convert the parsed rows, lists, and tables into structured table data. Keep rows and columns editable. Highlight missing or uncertain values instead of guessing. Prepare the output so it can be exported to CSV or Excel if export is available.",
    ),
  },
  {
    id: "rebuild-as-form",
    name: "Rebuild as Form",
    description: "Turn a rough scanned form into a clean digital form with labels and fillable fields.",
    category: "Form",
    scope: ["parsed"],
    inputRequirements: ["Form labels", "Fields", "Checkboxes", "Dates", "Signatures"],
    outputSchema: ["Form sections", "Editable field areas", "Printable layout", "Optional fillable structure"],
    primaryAction: "Create",
    highlight: "Best for admission forms, request forms, and school office paperwork.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Rebuild the parsed content as a clean digital form. Detect labels, fields, checkboxes, dates, signature areas, and section breaks. Make the output printable, editable, and suitable for a fillable form layout.",
    ),
  },
  {
    id: "create-formal-letter",
    name: "Create Formal Letter",
    description: "Turn notes or rough instructions into a proper formal letter.",
    category: "Letter",
    scope: ["parsed"],
    inputRequirements: ["Recipient details", "Topic or subject", "Body content"],
    outputSchema: ["Date", "Recipient block", "Subject line", "Body", "Closing", "Signature area"],
    primaryAction: "Create",
    highlight: "Best for office letters, requests, approvals, and notices.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Turn the parsed notes or instructions into a formal letter. Include the date, recipient, subject, letter body, closing, and signature or stamp area. Keep the result editable before final output.",
    ),
  },
  {
    id: "create-report",
    name: "Create Report",
    description: "Structure parsed content into a professional report with clear sections.",
    category: "Report",
    scope: ["parsed"],
    inputRequirements: ["Findings", "Observations", "Background notes", "Attachments if any"],
    outputSchema: ["Title", "Background", "Findings", "Observations", "Recommendations", "Conclusion"],
    primaryAction: "Create",
    highlight: "Best for inspection notes, school reports, and field writeups.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Convert the parsed content into a structured report. Include a title, background, findings, observations, recommendations, conclusion, and attachments if available. Keep the output editable and presentation-ready.",
    ),
  },
  {
    id: "generate-meeting-minutes",
    name: "Generate Meeting Minutes",
    description: "Convert meeting notes into clean minutes with action items.",
    category: "Meetings",
    scope: ["parsed"],
    inputRequirements: ["Meeting notes", "Date/time", "Attendees", "Agenda items"],
    outputSchema: ["Meeting title", "Date/time", "Attendees", "Agenda", "Discussions", "Resolutions", "Action items"],
    primaryAction: "Create",
    highlight: "Best for staff meetings, committee meetings, and school planning sessions.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Turn the parsed notes into meeting minutes. Include the meeting title, date and time, attendees, agenda, discussions, resolutions, action items, and next meeting details if present. Keep the result editable.",
    ),
  },
  {
    id: "create-action-plan",
    name: "Create Action Plan",
    description: "Extract tasks into a practical action plan with owners and deadlines.",
    category: "Planning",
    scope: ["parsed"],
    inputRequirements: ["Tasks", "Responsible people", "Due dates", "Priority notes"],
    outputSchema: ["Task", "Responsible person", "Due date", "Priority", "Status", "Notes"],
    primaryAction: "Create",
    highlight: "Best for follow-up lists, implementation notes, and school project plans.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Extract the tasks from the parsed content and turn them into a practical action plan. Include task, responsible person, due date, priority, status, and notes. Keep the structure editable.",
    ),
  },
  {
    id: "create-agreement",
    name: "Create Agreement",
    description: "Convert rough terms into a structured agreement with signature space.",
    category: "Agreement",
    scope: ["parsed"],
    inputRequirements: ["Parties", "Terms", "Duration", "Responsibilities", "Signatures"],
    outputSchema: ["Parties", "Purpose", "Terms", "Duration", "Responsibilities", "Termination", "Signatures", "Witness"],
    primaryAction: "Create",
    highlight: "Best for school partnerships, service agreements, and simple contracts.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Convert the rough terms into a structured agreement. Include the parties, purpose, terms, duration, payment or commission if present, responsibilities, termination, signatures, and witness section. Keep the document editable before final output.",
    ),
  },
  {
    id: "create-invoice-receipt",
    name: "Create Invoice / Receipt",
    description: "Turn payment or billing information into a clean invoice or receipt.",
    category: "Finance",
    scope: ["parsed"],
    inputRequirements: ["Customer details", "Items or services", "Amounts", "Payment status"],
    outputSchema: ["Customer", "Items/services", "Amounts", "Totals", "Balance", "Payment status", "Document number"],
    primaryAction: "Create",
    highlight: "Best for receipts, billing notes, and payment acknowledgements.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Convert the payment or billing information into a clean invoice or receipt. Include the customer, items or services, amounts, totals, balance, payment status, date, document number, and signature or stamp area. Keep the output editable.",
    ),
  },
  {
    id: "publish-secure-link",
    name: "Publish Secure Link",
    description: "Turn a generated Smart Page into a secure public link with optional password protection.",
    category: "Delivery",
    scope: ["ready"],
    inputRequirements: ["Generated Smart Page", "Optional password", "Public sharing enabled"],
    outputSchema: ["Secure public link", "Password protection if needed", "In-app print and download"],
    primaryAction: "Publish",
    highlight: "Best for sharing a finished page without leaving the app.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Prepare the generated Smart Page for secure publishing. Keep the page printable, downloadable, and suitable for a password-protected public link if needed.",
    ),
  },
  {
    id: "generate-in-bulk",
    name: "Generate in Bulk",
    description: "Use one template and a collection of records to generate many documents.",
    category: "Bulk",
    scope: ["bulk"],
    inputRequirements: ["Collection records", "Chosen template", "Bulk generation intent"],
    outputSchema: ["Per-record documents", "Generation status tracking", "Success and failure summaries"],
    primaryAction: "Generate",
    highlight: "Best for repeat documents that follow the same structure.",
    buildPrompt: (context) => buildBulkPrompt(context),
  },
];

export function getSmartPageTemplates(scope: SmartPageTemplateScope): SmartPageTemplateDefinition[] {
  return SMART_PAGE_TEMPLATES.filter((template) => template.scope.includes(scope));
}

export function getSmartPageTemplateById(templateId: string): SmartPageTemplateDefinition | undefined {
  return SMART_PAGE_TEMPLATES.find((template) => template.id === templateId);
}

