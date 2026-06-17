export type CreatorType = "SCHOOL_OPERATOR" | "EXTERNAL";

export type DocumentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

// ── Component system ───────────────────────────────────────────────────────────

export type ComponentType =
  | "header"
  | "textBlock"
  | "table"
  | "statistics"
  | "aiSummary"
  | "profileCard"
  | "signature"
  | "footer";

export interface HeaderProps {
  title: string;
  subtitle?: string;
  logoText?: string;
  date?: string;
  primaryColor?: string;
}

export interface TextBlockProps {
  heading?: string;
  content: string;
}

export interface TableProps {
  heading?: string;
  columns: string[];
  rows: Record<string, string | number>[];
}

export interface StatisticsProps {
  heading?: string;
  items: { label: string; value: string | number; change?: string }[];
}

export interface AiSummaryProps {
  heading?: string;
  content: string;
}

export interface ProfileCardProps {
  name: string;
  subtitle?: string;
  fields: { label: string; value: string }[];
  avatarText?: string;
}

export interface SignatureProps {
  label?: string;
  name?: string;
  date?: string;
}

export interface FooterProps {
  left?: string;
  center?: string;
  right?: string;
}

export interface ComponentNode {
  id: string;
  type: ComponentType;
  props: Record<string, unknown>;
}

// ── Document schema ────────────────────────────────────────────────────────────

export interface DocumentTheme {
  primaryColor: string;
  fontFamily: string;
  pageSize: "A4" | "LETTER";
  orientation: "PORTRAIT" | "LANDSCAPE";
}

export interface DocumentSchema {
  theme: DocumentTheme;
  components: ComponentNode[];
}

export const DEFAULT_THEME: DocumentTheme = {
  primaryColor: "#2563eb",
  fontFamily: "system-ui",
  pageSize: "A4",
  orientation: "PORTRAIT",
};

// ── Extracted knowledge ────────────────────────────────────────────────────────

export interface ExtractedSection {
  heading?: string;
  content: string;
}

export interface ExtractedTable {
  heading?: string;
  columns: string[];
  rows: Record<string, string | number>[];
}

export interface ExtractedStat {
  label: string;
  value: string | number;
}

export interface ExtractedKnowledge {
  documentType: string;
  domain: string;
  title: string;
  sections: ExtractedSection[];
  tables: ExtractedTable[];
  statistics: ExtractedStat[];
  entities: string[];
  rawText?: string;
}

// ── API types ──────────────────────────────────────────────────────────────────

export interface SmartDocumentSummary {
  id: string;
  title: string;
  status: DocumentStatus;
  domain?: string;
  createdAt: string;
  updatedAt: string;
  versionCount: number;
  hasSourceFiles: boolean;
  publishToken?: string;
}

export interface ActiveVersionSnapshot {
  id: string;
  instruction: string | null;
  schema: DocumentSchema;
  componentTree: ComponentNode[];
  createdAt: string;
}

export interface SmartDocumentDetail extends SmartDocumentSummary {
  extractedKnowledge: ExtractedKnowledge | null;
  activeVersion: ActiveVersionSnapshot | null;
}

export interface DocumentVersionSummary {
  id: string;
  parentId: string | null;
  instruction: string | null;
  createdAt: string;
}

export interface CreatorProfile {
  id: string;
  type: CreatorType;
  email: string;
  name: string;
}

// ── Chat message model ─────────────────────────────────────────────────────────

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  action?: "upload" | "generate" | "edit" | "publish" | "restore";
  versionId?: string;
}
