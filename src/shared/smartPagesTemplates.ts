import type { ExtractedKnowledge } from "./types/documentIntelligence";

export type SmartPagesVertical = "SCHOOL" | "LAWYER" | "GENERAL";

export type SmartPageTemplateScope = "parsed" | "ready" | "bulk";

export type SmartPageTemplateCategory =
  | "Document"
  | "Summary"
  | "Table"
  | "Form"
  | "Letter"
  | "Notice"
  | "Schedule"
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
  preferences?: Record<string, unknown> | null;
};

export type SmartPageTemplateDefinition = {
  id: string;
  name: string;
  description: string;
  vertical: SmartPagesVertical;
  category: SmartPageTemplateCategory;
  isActive: boolean;
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

export const SCHOOL_VERTICAL: SmartPagesVertical = "SCHOOL";
export const LAWYER_VERTICAL: SmartPagesVertical = "LAWYER";
export const GENERAL_VERTICAL: SmartPagesVertical = "GENERAL";

const SCHOOL_SAFE_GENERAL_TEMPLATE_IDS = new Set<string>();

export const SCHOOL_TEMPLATE_BLOCKED_TERMS = [
  "lawyer",
  "legal",
  "court",
  "affidavit",
  "case",
  "client",
  "contract",
];

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
    `Document title: ${context.documentTitle ?? knowledge?.title ?? "Untitled school document"}`,
    `Detected document type: ${knowledge?.documentType ?? "school document"}`,
    `Detected domain: ${knowledge?.domain ?? "education"}`,
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
    "You are processing a school document for School Connect Smart Pages.",
    instruction,
    "",
    "Use the parsed school content below as the source of truth.",
    buildContextSummary(context),
    "",
    "Make the output editable, polished, and ready for school review before print or download.",
  ].join("\n");
}

function buildSummaryPrompt(context: SmartPageTemplateContext): string {
  const style = SUMMARY_STYLES.find((item) => item.id === context.summaryStyleId) ?? SUMMARY_STYLES[0];
  return [
    "You are processing a school document for School Connect Smart Pages.",
    "Summarize the parsed school document.",
    `Style: ${style.name}. ${style.prompt}`,
    "",
    "Use the parsed school content below as the source of truth.",
    buildContextSummary(context),
    "",
    "Return a clean, editable summary with a clear school-friendly structure.",
  ].join("\n");
}

function buildBulkPrompt(context: SmartPageTemplateContext): string {
  return [
    "You are processing a school document for School Connect Smart Pages.",
    "Generate many school documents from the selected collection using one consistent template.",
    "Keep each generated document editable and track output status for every record.",
    "",
    "Use the school collection context below.",
    buildContextSummary(context),
  ].join("\n");
}

function schoolTemplate(
  template: Omit<SmartPageTemplateDefinition, "vertical" | "isActive">,
): SmartPageTemplateDefinition {
  return { ...template, vertical: SCHOOL_VERTICAL, isActive: true };
}

export const SMART_PAGE_TEMPLATES: SmartPageTemplateDefinition[] = [
  schoolTemplate({
    id: "clean-rebuild-document",
    name: "Clean & Rebuild Document",
    description: "Recreate the parsed school document as a clean professional document while preserving meaning and structure.",
    category: "Document",
    scope: ["parsed"],
    inputRequirements: ["Parsed text", "Sections", "Tables where available"],
    outputSchema: ["Editable headings", "Rebuilt body text", "Structured tables", "Printable layout"],
    primaryAction: "Create",
    highlight: "Best for keeping the original layout idea while making it polished.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Recreate the parsed school document as a clean professional document. Preserve meaning and structure. Fix spelling, spacing, and grammar. Rebuild tables where possible. Keep the output editable and ready for print or download.",
    ),
  }),
  schoolTemplate({
    id: "editable-smart-page",
    name: "Create Editable Smart Page",
    description: "Convert parsed school content into an editable Smart Page with sections, fields, and tables.",
    category: "Document",
    scope: ["parsed"],
    inputRequirements: ["Parsed text", "Detected sections", "Detected tables"],
    outputSchema: ["Editable sections", "Editable fields", "Editable tables", "Version history ready"],
    primaryAction: "Create",
    highlight: "Best for documents that will keep changing after import.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Convert the parsed school content into an editable Smart Page. Organize it into clear sections, fields, and tables that can be edited later. Keep the structure clean and suitable for in-app preview, version history, and print or download.",
    ),
  }),
  schoolTemplate({
    id: "summarize-document",
    name: "Summarize Document",
    description: "Turn the parsed school content into a clear summary with a style that fits the reader.",
    category: "Summary",
    scope: ["parsed"],
    inputRequirements: ["Parsed text", "Sections", "Key facts"],
    outputSchema: ["Summary title", "Key points", "Action items where relevant"],
    primaryAction: "Summarize",
    highlight: "Choose the summary style before creating the output.",
    buildPrompt: (context) => buildSummaryPrompt(context),
  }),
  schoolTemplate({
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
  }),
  schoolTemplate({
    id: "rebuild-as-form",
    name: "Rebuild as Form",
    description: "Turn a rough scanned school form into a clean digital form with labels and fillable fields.",
    category: "Form",
    scope: ["parsed"],
    inputRequirements: ["Form labels", "Fields", "Checkboxes", "Dates", "Signatures"],
    outputSchema: ["Form sections", "Editable field areas", "Printable layout", "Optional fillable structure"],
    primaryAction: "Create",
    highlight: "Best for admission forms, request forms, and school office paperwork.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Rebuild the parsed school content as a clean digital form. Detect labels, fields, checkboxes, dates, signature areas, and section breaks. Make the output printable, editable, and suitable for a fillable form layout.",
    ),
  }),
  schoolTemplate({
    id: "school-notice",
    name: "School Notice",
    description: "Turn school notes into a clear notice for staff, learners, or families.",
    category: "Notice",
    scope: ["parsed"],
    inputRequirements: ["Audience", "Topic", "Date", "Instructions"],
    outputSchema: ["Title", "Date", "Audience", "Message", "Action required", "Issued by"],
    primaryAction: "Create",
    highlight: "Best for short school announcements.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Turn the parsed notes into a school notice. Include the title, date, audience, message, action required, and issued-by line. Keep it concise, respectful, and editable.",
    ),
  }),
  schoolTemplate({
    id: "school-circular",
    name: "School Circular",
    description: "Create a polished circular for school-wide communication.",
    category: "Notice",
    scope: ["parsed"],
    inputRequirements: ["Circular topic", "Audience", "Details", "Dates"],
    outputSchema: ["Circular number", "Subject", "Body", "Important dates", "Action required", "Signature area"],
    primaryAction: "Create",
    highlight: "Best for formal school updates.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Create a school circular from the parsed content. Include a subject, body, important dates, action required, and signature or stamp area. Keep the wording clear for school communication.",
    ),
  }),
  schoolTemplate({
    id: "school-programme",
    name: "School Programme",
    description: "Build an event programme with sessions, times, and responsible people.",
    category: "Schedule",
    scope: ["parsed"],
    inputRequirements: ["Event name", "Activities", "Times", "People responsible"],
    outputSchema: ["Event title", "Date", "Venue", "Programme table", "Notes"],
    primaryAction: "Create",
    highlight: "Best for assemblies, visitation days, graduations, and school events.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Build a school event programme from the parsed content. Include the event title, date, venue, activities, times, people responsible, and notes. Use a clean table where useful.",
    ),
  }),
  schoolTemplate({
    id: "timetable",
    name: "Timetable",
    description: "Convert timetable notes into a clear schedule.",
    category: "Schedule",
    scope: ["parsed"],
    inputRequirements: ["Days", "Times", "Subjects or activities", "Classes or groups"],
    outputSchema: ["Day", "Time", "Class or group", "Subject or activity", "Teacher or owner"],
    primaryAction: "Create",
    highlight: "Best for class, duty, revision, and activity schedules.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Convert the parsed timetable notes into a clear school timetable. Include days, times, class or group, subject or activity, and teacher or owner where present. Mark unclear entries for review.",
    ),
  }),
  schoolTemplate({
    id: "exam-schedule",
    name: "Exam Schedule",
    description: "Create an exam schedule with dates, times, subjects, and classes.",
    category: "Schedule",
    scope: ["parsed"],
    inputRequirements: ["Exam dates", "Times", "Subjects", "Classes"],
    outputSchema: ["Date", "Time", "Class", "Subject", "Venue", "Notes"],
    primaryAction: "Create",
    highlight: "Best for termly assessments and exam timetables.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Create an exam schedule from the parsed content. Include date, time, class, subject, venue, and notes where available. Keep entries organized and easy to review.",
    ),
  }),
  schoolTemplate({
    id: "meeting-minutes",
    name: "Meeting Minutes",
    description: "Convert meeting notes into clean minutes with action items.",
    category: "Meetings",
    scope: ["parsed"],
    inputRequirements: ["Meeting notes", "Date/time", "Attendees", "Agenda items"],
    outputSchema: ["Meeting title", "Date/time", "Attendees", "Agenda", "Discussions", "Resolutions", "Action items"],
    primaryAction: "Create",
    highlight: "Best for staff meetings, committee meetings, and school planning sessions.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Turn the parsed school meeting notes into meeting minutes. Include the meeting title, date and time, attendees, agenda, discussions, resolutions, action items, and next meeting details if present. Keep the result editable.",
    ),
  }),
  schoolTemplate({
    id: "action-plan",
    name: "Action Plan",
    description: "Extract tasks into a practical action plan with owners and deadlines.",
    category: "Planning",
    scope: ["parsed"],
    inputRequirements: ["Tasks", "Responsible people", "Due dates", "Priority notes"],
    outputSchema: ["Task", "Responsible person", "Due date", "Priority", "Status", "Notes"],
    primaryAction: "Create",
    highlight: "Best for follow-up lists, implementation notes, and school project plans.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Extract the tasks from the parsed school content and turn them into a practical action plan. Include task, responsible person, due date, priority, status, and notes. Keep the structure editable.",
    ),
  }),
  schoolTemplate({
    id: "letter-to-parents",
    name: "Letter to Parents",
    description: "Turn notes or rough instructions into a clear letter for parents or guardians.",
    category: "Letter",
    scope: ["parsed"],
    inputRequirements: ["Recipient group", "Topic or subject", "Body content"],
    outputSchema: ["Date", "Recipient line", "Subject line", "Body", "Closing", "Signature area"],
    primaryAction: "Create",
    highlight: "Best for family communication, reminders, requests, and updates.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Turn the parsed notes or instructions into a letter to parents or guardians. Include the date, recipient line, subject, body, closing, and signature or stamp area. Keep the result editable before final output.",
    ),
  }),
  schoolTemplate({
    id: "permission-slip",
    name: "Permission Slip",
    description: "Create a parent or guardian permission slip for a school activity.",
    category: "Form",
    scope: ["parsed"],
    inputRequirements: ["Activity", "Date", "Learner details", "Consent wording"],
    outputSchema: ["Activity details", "Learner information", "Parent or guardian consent", "Emergency contact", "Signature area"],
    primaryAction: "Create",
    highlight: "Best for trips, activities, and consent forms.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Create a permission slip from the parsed school content. Include activity details, learner information, parent or guardian consent, emergency contact, date, and signature area. Keep it printable and editable.",
    ),
  }),
  schoolTemplate({
    id: "student-list",
    name: "Student List",
    description: "Convert names or register details into a clean student list.",
    category: "Table",
    scope: ["parsed"],
    inputRequirements: ["Student names", "Class or stream", "Admission numbers where available"],
    outputSchema: ["No.", "Student name", "Class", "Admission number", "Notes"],
    primaryAction: "Create",
    highlight: "Best for class lists and school registers.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Convert the parsed names or register details into a clean student list. Include numbering, student name, class, admission number where present, and notes. Mark unclear entries for review.",
    ),
  }),
  schoolTemplate({
    id: "attendance-sheet",
    name: "Attendance Sheet",
    description: "Build an attendance sheet for a class, meeting, or school activity.",
    category: "Table",
    scope: ["parsed"],
    inputRequirements: ["Names", "Date", "Class or group", "Attendance marks"],
    outputSchema: ["No.", "Name", "Class or group", "Present", "Absent", "Remarks"],
    primaryAction: "Create",
    highlight: "Best for daily attendance, events, and staff meetings.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Build an attendance sheet from the parsed content. Include numbering, name, class or group, present, absent, and remarks columns. Keep it easy to print and update.",
    ),
  }),
  schoolTemplate({
    id: "report",
    name: "Report",
    description: "Structure parsed school content into a professional report with clear sections.",
    category: "Report",
    scope: ["parsed"],
    inputRequirements: ["Findings", "Observations", "Background notes", "Attachments if any"],
    outputSchema: ["Title", "Background", "Findings", "Observations", "Recommendations", "Conclusion"],
    primaryAction: "Create",
    highlight: "Best for inspection notes, school reports, and field writeups.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Convert the parsed school content into a structured report. Include a title, background, findings, observations, recommendations, conclusion, and attachments if available. Keep the output editable and presentation-ready.",
    ),
  }),
  schoolTemplate({
    id: "invoice-receipt",
    name: "Invoice / Receipt",
    description: "Turn school payment or billing information into a clean invoice or receipt.",
    category: "Finance",
    scope: ["parsed"],
    inputRequirements: ["Payer details", "Items or services", "Amounts", "Payment status"],
    outputSchema: ["Payer", "Items/services", "Amounts", "Totals", "Balance", "Payment status", "Document number"],
    primaryAction: "Create",
    highlight: "Best for receipts, billing notes, and payment acknowledgements.",
    buildPrompt: (context) => buildDocumentPrompt(
      context,
      "Convert the school payment or billing information into a clean invoice or receipt. Include the payer, items or services, amounts, totals, balance, payment status, date, document number, and signature or stamp area. Keep the output editable.",
    ),
  }),
  schoolTemplate({
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
  }),
  schoolTemplate({
    id: "generate-in-bulk",
    name: "Generate in Bulk",
    description: "Use one template and a collection of school records to generate many documents.",
    category: "Bulk",
    scope: ["bulk"],
    inputRequirements: ["Collection records", "Chosen template", "Bulk generation intent"],
    outputSchema: ["Per-record documents", "Generation status tracking", "Success and failure summaries"],
    primaryAction: "Generate",
    highlight: "Best for repeat school documents that follow the same structure.",
    buildPrompt: (context) => buildBulkPrompt(context),
  }),
];

export function isTemplateAllowedForVertical(
  template: SmartPageTemplateDefinition,
  vertical: SmartPagesVertical,
): boolean {
  if (!template.isActive) return false;
  if (template.vertical === vertical) return true;
  if (vertical === SCHOOL_VERTICAL && template.vertical === GENERAL_VERTICAL) {
    return SCHOOL_SAFE_GENERAL_TEMPLATE_IDS.has(template.id);
  }
  return false;
}

export function getSmartPageTemplates(
  scope: SmartPageTemplateScope,
  vertical: SmartPagesVertical = SCHOOL_VERTICAL,
): SmartPageTemplateDefinition[] {
  return SMART_PAGE_TEMPLATES.filter((template) => template.scope.includes(scope) && isTemplateAllowedForVertical(template, vertical));
}

export function getSmartPageTemplateById(
  templateId: string,
  vertical: SmartPagesVertical = SCHOOL_VERTICAL,
): SmartPageTemplateDefinition | undefined {
  return SMART_PAGE_TEMPLATES.find((template) => template.id === templateId && isTemplateAllowedForVertical(template, vertical));
}

export function searchSmartPageTemplates(
  query: string,
  scope?: SmartPageTemplateScope,
  vertical: SmartPagesVertical = SCHOOL_VERTICAL,
): SmartPageTemplateDefinition[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return scope ? getSmartPageTemplates(scope, vertical) : SMART_PAGE_TEMPLATES.filter((template) => isTemplateAllowedForVertical(template, vertical));
  return SMART_PAGE_TEMPLATES.filter((template) => {
    if (scope && !template.scope.includes(scope)) return false;
    if (!isTemplateAllowedForVertical(template, vertical)) return false;
    const haystack = [
      template.id,
      template.name,
      template.description,
      template.category,
      template.highlight,
      ...template.inputRequirements,
      ...template.outputSchema,
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(normalized);
  });
}
