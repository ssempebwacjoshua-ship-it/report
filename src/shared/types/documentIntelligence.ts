export type CreatorType = "SCHOOL_OPERATOR" | "EXTERNAL";

export type DocumentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

// â”€â”€ Component system â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Document schema â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Extracted knowledge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

export interface ExtractedUnclearItem {
  label: string;
  value?: string;
  reason: string;
  unclear: true;
}

export interface ExtractedUnclearTableCell {
  row: number;
  column: string;
  value: string;
  reason: string;
}

export type HandwritingDifficulty = "low" | "medium" | "high";
export type ExtractionRecommendation = "accept" | "review" | "high_accuracy_retry";

export interface ExtractedKnowledge {
  documentType: string;
  domain: string;
  title: string;
  sections: ExtractedSection[];
  tables: ExtractedTable[];
  statistics: ExtractedStat[];
  entities: string[];
  people?: string[];
  dates?: string[];
  handwrittenNotes?: ExtractedSection[];
  keyFacts?: string[];
  unclearItems?: ExtractedUnclearItem[];
  unclearTableCells?: ExtractedUnclearTableCell[];
  suggestedDocumentType?: string;
  ocrQualityNotes?: string[];
  reviewWarning?: string;
  confidence?: number;
  handwritingDifficulty?: HandwritingDifficulty;
  needsReview?: boolean;
  recommendedNextStep?: ExtractionRecommendation;
  rawText?: string;
}

// â”€â”€ API types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SmartDocumentSummary {
  id: string;
  title: string;
  status: DocumentStatus;
  extractionStatus?: "IDLE" | "PROCESSING" | "READY" | "FAILED";
  extractionError?: string | null;
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
  renderSettings?: {
    fitToOnePage?: boolean;
    compact?: boolean;
    fontScale?: number;
    spacing?: "normal" | "compact";
  };
  createdAt: string;
}

export interface SmartDocumentDetail extends SmartDocumentSummary {
  extractedKnowledge: ExtractedKnowledge | null;
  activeVersion: ActiveVersionSnapshot | null;
  latestSourceFile?: {
    id: string;
    status: "UPLOADED" | "PREPROCESSING" | "EXTRACTING" | "READY" | "FAILED";
    originalName: string;
    extractionError?: string | null;
    extractionStartedAt?: string | null;
    extractionCompletedAt?: string | null;
  };
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

// â”€â”€ Chat message model â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  action?: "upload" | "generate" | "edit" | "publish" | "restore";
  versionId?: string;
}

