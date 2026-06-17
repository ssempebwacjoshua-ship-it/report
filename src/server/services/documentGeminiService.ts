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

export async function extractDocumentKnowledge(
  fileBuffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<ExtractedKnowledge> {
  const res = await getClient().models.generateContent({
    model: model(),
    contents: [
      { inlineData: { data: fileBuffer.toString("base64"), mimeType } },
      {
        text: `You are a Document Intelligence Engine. Analyze this document and extract all content.

Return ONLY valid JSON (no markdown, no code fences):
{
  "documentType": "report | form | table | letter | certificate | invoice | other",
  "domain": "education | healthcare | legal | business | nonprofit | general",
  "title": "inferred title",
  "sections": [{ "heading": "string or null", "content": "string" }],
  "tables": [{ "heading": "string or null", "columns": ["col1"], "rows": [{"col1": "val"}] }],
  "statistics": [{ "label": "string", "value": "string or number" }],
  "entities": ["name1", "name2"],
  "rawText": "full text content"
}

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
    sections: [{ content: text }],
    tables: [],
    statistics: [],
    entities: [],
    rawText: text,
  };

  return parseJsonSafe<ExtractedKnowledge>(text, fallback);
}

export async function generateDocumentSchema(
  knowledge: ExtractedKnowledge,
  intent: string,
  primaryColor = "#2563eb",
): Promise<{ schema: DocumentSchema; componentTree: ComponentNode[] }> {
  const res = await getClient().models.generateContent({
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
): Promise<{ theme: DocumentSchema["theme"]; components: ComponentNode[] }> {
  const res = await getClient().models.generateContent({
    model: model(),
    contents: [
      {
        text: `You are a Document Intelligence Engine. Create a TEMPLATE document schema for bulk generation.

Collection type: ${collectionType}
User intent: "${intent}"

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
): Promise<{ schema: DocumentSchema; componentTree: ComponentNode[] }> {
  const res = await getClient().models.generateContent({
    model: model(),
    contents: [
      {
        text: `You are a Document Intelligence Engine. Apply an editing instruction to this document schema.

Current schema:
${JSON.stringify(currentSchema, null, 2)}

Instruction: "${instruction}"

Return ONLY the COMPLETE updated schema as valid JSON (no markdown, no explanation):
{
  "theme": { "primaryColor": "...", "fontFamily": "...", "pageSize": "...", "orientation": "..." },
  "components": [ { "id": "...", "type": "...", "props": { ... } } ]
}

Apply the instruction exactly. Preserve all content unless explicitly told to change or remove it.
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
