import { GoogleGenAI } from "@google/genai";
import type { DocumentSchema, ComponentNode, ExtractedKnowledge } from "../../shared/types/documentIntelligence";

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");
  if (!_client) _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _client;
}

function model() {
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}
async function generateContentWithRetry(request: Parameters<GoogleGenAI["models"]["generateContent"]>[0]) {
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS ?? 45_000);
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await withTimeout(getClient().models.generateContent(request), timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini request failed. Please retry.");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Gemini request timed out. Please retry.")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
}

function parseJsonSafe<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(stripFences(text)) as T;
  } catch {
    return fallback;
  }
}

function formatPreferences(preferences?: Record<string, unknown>): string {
  if (!preferences || Object.keys(preferences).length === 0) return "No stored creator preferences.";
  return Object.entries(preferences)
    .map(([key, value]) => `- ${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join("\n");
}

export async function extractDocumentKnowledge(
  fileBuffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<ExtractedKnowledge> {
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      { inlineData: { data: fileBuffer.toString("base64"), mimeType } },
      {
        text: `You are a Document Intelligence Engine. Analyze this document and extract all content.

Return ONLY valid JSON (no markdown, no code fences):
{
  "documentType": "report | form | table | letter | certificate | invoice | handwritten_note | other",
  "domain": "education | healthcare | legal | business | nonprofit | general",
  "title": "inferred title",
  "suggestedDocumentType": "best document type for polished output",
  "people": ["person names only"],
  "dates": ["dates exactly as written"],
  "sections": [{ "heading": "string or null", "content": "string" }],
  "tables": [{ "heading": "string or null", "columns": ["col1"], "rows": [{"col1": "val"}] }],
  "statistics": [{ "label": "string", "value": "string or number" }],
  "entities": ["all named entities"],
  "handwrittenNotes": [{ "heading": "string or null", "content": "string" }],
  "keyFacts": ["fact exactly supported by visible content"],
  "unclearItems": [{ "label": "field or area", "value": "best visible fragment or empty", "reason": "why unclear", "unclear": true }],
  "rawText": "full text content"
}

Rules:
- Return JSON only.
- Do not hallucinate missing content.
- If handwriting or a field is unclear, put it in unclearItems with "unclear": true.
- Preserve original wording where possible.
- Extract tables only when table structure is visible.
- For off-frame, tilted, dark, or low-confidence content, add an unclearItems entry instead of guessing.

Document filename: ${originalName}`,
      },
    ],
    config: { temperature: 0 },
  });

  const text = res.text ?? "";
  const fallback: ExtractedKnowledge = {
    documentType: "document",
    domain: "general",
    title: originalName.replace(/\.[^.]+$/, ""),
    suggestedDocumentType: "document",
    sections: [{ content: text }],
    tables: [],
    statistics: [],
    entities: [],
    people: [],
    dates: [],
    handwrittenNotes: [],
    keyFacts: [],
    unclearItems: [],
    rawText: text,
  };

  return parseJsonSafe<ExtractedKnowledge>(text, fallback);
}

export async function generateDocumentSchema(
  knowledge: ExtractedKnowledge,
  intent: string,
  primaryColor = "#2563eb",
  preferences?: Record<string, unknown>,
): Promise<{ schema: DocumentSchema; componentTree: ComponentNode[] }> {
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `You are a Document Intelligence Engine. Generate a document schema.

Available component types:
- header: { title, subtitle?, logoText?, date?, primaryColor? }
- textBlock: { heading?, content }
- table: { heading?, columns: string[], rows: Record<string,string|number>[] }
- statistics: { heading?, items: [{ label, value, change? }] }
- aiSummary: { heading?, content }
- profileCard: { name, subtitle?, fields: [{ label, value }], avatarText? }
- signature: { label?, name?, date? }
- footer: { left?, center?, right? }

User intent: "${intent}"
Domain: ${knowledge.domain}
Document type: ${knowledge.documentType}

Stored creator preferences:
${formatPreferences(preferences)}

Extracted knowledge:
${JSON.stringify(knowledge, null, 2)}

Return ONLY valid JSON (no markdown):
{
  "theme": {
    "primaryColor": "${primaryColor}",
    "fontFamily": "system-ui",
    "pageSize": "A4",
    "orientation": "PORTRAIT"
  },
  "components": [
    { "id": "h1", "type": "header", "props": { ... } }
  ]
}

Rules:
- First component MUST be header, last MUST be footer
- Use real data from the extracted knowledge — no placeholder text
- Apply stored creator preferences automatically when relevant
- Generate short unique IDs (h1, tb1, t1, s1, ai1, f1, etc.)
- Include all tables from extracted knowledge as table components`,
      },
    ],
    config: { temperature: 0.3 },
  });

  const text = res.text ?? "";
  const fallbackComponents: ComponentNode[] = [
    { id: "h1", type: "header", props: { title: knowledge.title, date: new Date().toLocaleDateString() } },
    ...knowledge.sections.slice(0, 3).map((s, i) => ({
      id: `tb${i + 1}`,
      type: "textBlock" as const,
      props: { heading: s.heading ?? undefined, content: s.content },
    })),
    { id: "f1", type: "footer", props: { center: knowledge.domain } },
  ];

  const parsed = parseJsonSafe<{ theme: DocumentSchema["theme"]; components: ComponentNode[] }>(text, {
    theme: { primaryColor, fontFamily: "system-ui", pageSize: "A4", orientation: "PORTRAIT" },
    components: fallbackComponents,
  });

  return { schema: { theme: parsed.theme, components: parsed.components }, componentTree: parsed.components };
}

export async function generateBulkTemplate(
  sampleRecords: Record<string, unknown>[],
  intent: string,
  collectionType: string,
  preferences?: Record<string, unknown>,
): Promise<{ theme: DocumentSchema["theme"]; components: ComponentNode[] }> {
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `You are a Document Intelligence Engine. Create a TEMPLATE document schema for bulk generation.

Collection type: ${collectionType}
User intent: "${intent}"

Stored creator preferences:
${formatPreferences(preferences)}

Sample records (${sampleRecords.length} of many):
${JSON.stringify(sampleRecords, null, 2)}

Return a template schema where dynamic values use {{fieldName}} placeholders.
For example: "title": "Report for {{name}}" or "content": "Score: {{math}}"

Available component types:
- header: { title, subtitle?, logoText?, date?, primaryColor? }
- textBlock: { heading?, content }
- table: { heading?, columns: string[], rows: [{"col": "{{field}}"}] }
- statistics: { heading?, items: [{ label, value: "{{field}}", change? }] }
- aiSummary: { heading?, content }
- profileCard: { name: "{{name}}", subtitle?, fields: [{ label, value: "{{field}}" }], avatarText?: "{{initials}}" }
- signature: { label?, name?, date? }
- footer: { left?, center?, right? }

Return ONLY valid JSON (no markdown):
{
  "theme": { "primaryColor": "#2563eb", "fontFamily": "system-ui", "pageSize": "A4", "orientation": "PORTRAIT" },
  "components": [ { "id": "h1", "type": "header", "props": { "title": "Report for {{name}}" } } ]
}

Rules:
- Use {{fieldName}} placeholders for all record-specific data
- First component MUST be header, last MUST be footer
- Apply stored creator preferences automatically when relevant
- Use every significant field from the sample records
- Generate unique short IDs for each component`,
      },
    ],
    config: { temperature: 0.2 },
  });

  const text = res.text ?? "";
  const fallbackComponents: ComponentNode[] = [
    {
      id: "h1",
      type: "header",
      props: { title: `${collectionType} Document — {{name}}`, date: new Date().toLocaleDateString() },
    },
    { id: "f1", type: "footer", props: { center: collectionType } },
  ];

  return parseJsonSafe<{ theme: DocumentSchema["theme"]; components: ComponentNode[] }>(text, {
    theme: { primaryColor: "#2563eb", fontFamily: "system-ui", pageSize: "A4", orientation: "PORTRAIT" },
    components: fallbackComponents,
  });
}

export async function applyPromptToSchema(
  currentSchema: DocumentSchema,
  instruction: string,
  preferences?: Record<string, unknown>,
): Promise<{ schema: DocumentSchema; componentTree: ComponentNode[] }> {
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `You are a Document Intelligence Engine. Apply an editing instruction to this document schema.

Current schema:
${JSON.stringify(currentSchema, null, 2)}

Stored creator preferences:
${formatPreferences(preferences)}

Instruction: "${instruction}"

Return ONLY the COMPLETE updated schema as valid JSON (no markdown, no explanation):
{
  "theme": { "primaryColor": "...", "fontFamily": "...", "pageSize": "...", "orientation": "..." },
  "components": [ { "id": "...", "type": "...", "props": { ... } } ]
}

Apply the instruction exactly. Preserve all content unless explicitly told to change or remove it.
Apply stored creator preferences automatically when relevant.
Available component types: header, textBlock, table, statistics, aiSummary, profileCard, signature, footer`,
      },
    ],
    config: { temperature: 0.3 },
  });

  const text = res.text ?? "";
  const parsed = parseJsonSafe<{ theme: DocumentSchema["theme"]; components: ComponentNode[] }>(text, {
    theme: currentSchema.theme,
    components: currentSchema.components,
  });

  return { schema: { theme: parsed.theme, components: parsed.components }, componentTree: parsed.components };
}

export async function runGeminiAgent(input: {
  systemPrompt: string;
  instruction: string;
  context: unknown;
}): Promise<{ response: string; suggestedActions: string[] }> {
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `${input.systemPrompt}

Instruction:
${input.instruction}

Context:
${JSON.stringify(input.context, null, 2)}

Return ONLY valid JSON:
{
  "response": "concise answer",
  "suggestedActions": ["action 1", "action 2"]
}`,
      },
    ],
    config: { temperature: 0.2 },
  });

  return parseJsonSafe<{ response: string; suggestedActions: string[] }>(res.text ?? "", {
    response: res.text ?? "",
    suggestedActions: [],
  });
}

export async function translateDocumentSchema(
  currentSchema: DocumentSchema,
  language: "Arabic" | "French" | "Swahili" | "Spanish",
): Promise<{ schema: DocumentSchema; componentTree: ComponentNode[] }> {
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `Translate all user-facing text in this document schema to ${language}.

Do not change component IDs, component types, data structure, colors, page size, or orientation.
Never overwrite the existing version; the caller will save this as a new version.

Schema:
${JSON.stringify(currentSchema, null, 2)}

Return ONLY the translated complete schema as valid JSON:
{
  "theme": { ... },
  "components": [ ... ]
}`,
      },
    ],
    config: { temperature: 0 },
  });

  const parsed = parseJsonSafe<{ theme: DocumentSchema["theme"]; components: ComponentNode[] }>(res.text ?? "", {
    theme: currentSchema.theme,
    components: currentSchema.components,
  });
  return { schema: { theme: parsed.theme, components: parsed.components }, componentTree: parsed.components };
}

export async function summarizeDocumentSchema(
  currentSchema: DocumentSchema,
): Promise<{ summary: string; keyPoints: string[] }> {
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `Summarize this document schema for the creator.

Schema:
${JSON.stringify(currentSchema, null, 2)}

Return ONLY valid JSON:
{
  "summary": "short plain-language summary",
  "keyPoints": ["point 1", "point 2"]
}`,
      },
    ],
    config: { temperature: 0.1 },
  });

  return parseJsonSafe<{ summary: string; keyPoints: string[] }>(res.text ?? "", {
    summary: "Summary unavailable.",
    keyPoints: [],
  });
}

export async function rewriteDocumentTone(
  currentSchema: DocumentSchema,
  tone: string,
): Promise<{ schema: DocumentSchema; componentTree: ComponentNode[] }> {
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `Rewrite all user-facing text in this document schema using this tone: ${tone}.

Do not change component IDs, component types, data structure, colors, page size, or orientation.

Schema:
${JSON.stringify(currentSchema, null, 2)}

Return ONLY the rewritten complete schema as valid JSON:
{
  "theme": { ... },
  "components": [ ... ]
}`,
      },
    ],
    config: { temperature: 0.25 },
  });

  const parsed = parseJsonSafe<{ theme: DocumentSchema["theme"]; components: ComponentNode[] }>(res.text ?? "", {
    theme: currentSchema.theme,
    components: currentSchema.components,
  });
  return { schema: { theme: parsed.theme, components: parsed.components }, componentTree: parsed.components };
}

export async function classifyDocumentSchema(
  currentSchema: DocumentSchema,
): Promise<{ documentType: string; domain: string; confidence: number; tags: string[] }> {
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `Classify this document schema.

Schema:
${JSON.stringify(currentSchema, null, 2)}

Return ONLY valid JSON:
{
  "documentType": "report | form | table | letter | certificate | invoice | other",
  "domain": "education | healthcare | legal | business | nonprofit | general",
  "confidence": 0.0,
  "tags": ["tag"]
}`,
      },
    ],
    config: { temperature: 0 },
  });

  return parseJsonSafe<{ documentType: string; domain: string; confidence: number; tags: string[] }>(res.text ?? "", {
    documentType: "other",
    domain: "general",
    confidence: 0,
    tags: [],
  });
}

export async function assistSearchRanking(input: {
  query: string;
  results: Array<{ id: string; entityType: string; title: string | null; snippet: string; score: number }>;
}): Promise<{ rankedIds: string[]; explanation: string }> {
  if (input.results.length === 0) return { rankedIds: [], explanation: "No results to rank." };
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `Rank these search results for the user query using semantic relevance.

Query: ${input.query}
Results:
${JSON.stringify(input.results, null, 2)}

Return ONLY valid JSON:
{
  "rankedIds": ["result id in best order"],
  "explanation": "brief reason"
}`,
      },
    ],
    config: { temperature: 0 },
  });

  return parseJsonSafe<{ rankedIds: string[]; explanation: string }>(res.text ?? "", {
    rankedIds: input.results.map((result) => result.id),
    explanation: "Ranked by lexical score.",
  });
}

export async function suggestWorkflow(input: {
  creatorPreferences: Record<string, unknown>;
  context: unknown;
}): Promise<{ name: string; trigger: string; actions: Array<{ type: string; config?: Record<string, unknown> }>; rationale: string }> {
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `Suggest one useful document automation workflow for this creator.

Creator preferences:
${formatPreferences(input.creatorPreferences)}

Context:
${JSON.stringify(input.context, null, 2)}

Supported triggers: COLLECTION_IMPORTED, RECORD_ADDED, DOCUMENT_CREATED, BULK_GENERATION_COMPLETED, PUBLISH_COMPLETED
Supported actions: GENERATE_DOCUMENT, PUBLISH_DOCUMENT, EXPORT_PDF, NOTIFY_CREATOR, SEND_EMAIL

Return ONLY valid JSON:
{
  "name": "workflow name",
  "trigger": "SUPPORTED_TRIGGER",
  "actions": [{ "type": "SUPPORTED_ACTION", "config": {} }],
  "rationale": "brief reason"
}`,
      },
    ],
    config: { temperature: 0.2 },
  });

  return parseJsonSafe(res.text ?? "", {
    name: "Notify when bulk generation completes",
    trigger: "BULK_GENERATION_COMPLETED",
    actions: [{ type: "NOTIFY_CREATOR" }],
    rationale: "Keeps the creator informed when automated generation has finished.",
  });
}
