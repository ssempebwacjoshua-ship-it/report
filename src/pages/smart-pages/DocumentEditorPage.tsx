import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  applyPrompt,
  downloadDocumentExport,
  generateSchema,
  getDocument,
  getVersionHistory,
  openPrintWindow,
  publishDocument,
  retryDocumentExtraction,
  restoreVersion,
  updateExtractedKnowledge,
  uploadDocumentFile,
} from "../../client/documentIntelligenceClient";
import { listPreferences } from "../../client/documentOsClient";
import { DocumentPreview } from "../../components/smart-pages/DocumentPreview";
import { SmartPageTemplatePicker } from "../../components/smart-pages/SmartPageTemplatePicker";
import { getSmartPageTemplates, type SmartPageTemplateDefinition } from "../../shared/smartPagesTemplates";
import { buildLawyerTemplateStarterDraft, getLawyerPageTemplateById, getLawyerPageTemplates } from "../../shared/lawyerTemplates";
import type {
  ChatMessage,
  ComponentNode,
  DocumentSchema,
  DocumentVersionSummary,
  ExtractedKnowledge,
  SmartDocumentDetail,
} from "../../shared/types/documentIntelligence";
import { DEFAULT_THEME } from "../../shared/types/documentIntelligence";
import { randomUUID } from "../../utils/uuid";

// ── Chat bubble ───────────────────────────────────────────────────────────────

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isSystem
            ? "bg-slate-100 text-slate-500 italic text-xs"
            : isUser
              ? "bg-blue-600 text-white"
              : "bg-white border border-slate-200 text-slate-800 shadow-sm"
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

// ── Suggestion chips ───────────────────────────────────────────────────────────

const INITIAL_SUGGESTIONS = [
  "Make it professional",
  "Add a summary section",
  "Use blue theme",
  "Make it fit on one page",
];

const POST_GENERATE_SUGGESTIONS = [
  "Add a chart",
  "Make it more formal",
  "Add rankings",
  "Translate to Arabic",
  "Add a signature section",
  "Simplify the layout",
];

function SuggestionChips({ items, onSelect, disabled = false }: { items: string[]; onSelect: (s: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-2">
      {items.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onSelect(s)}
          disabled={disabled}
          className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function ExtractionReviewPanel({
  knowledge,
  editing,
  draft,
  saving,
  onEdit,
  onDraftChange,
  onSave,
  onGenerate,
  generateDisabled,
  templates,
  onPickTemplate,
  onHighAccuracyRetry,
  highAccuracyDisabled,
  retryingHighAccuracy,
  primaryActionLabel,
  pickerLabel,
  pickerHeading,
  pickerDescription,
}: {
  knowledge: ExtractedKnowledge;
  editing: boolean;
  draft: string;
  saving: boolean;
  onEdit: () => void;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onGenerate: () => void;
  generateDisabled: boolean;
  templates: SmartPageTemplateDefinition[];
  onPickTemplate: (template: SmartPageTemplateDefinition, options?: { summaryStyleId?: string }) => void;
  onHighAccuracyRetry: () => void;
  highAccuracyDisabled: boolean;
  retryingHighAccuracy: boolean;
  primaryActionLabel: string;
  pickerLabel: string;
  pickerHeading: string;
  pickerDescription: string;
}) {
  const unclear = knowledge.unclearItems ?? [];
  const confidence = typeof knowledge.confidence === "number" ? Math.round(knowledge.confidence * 100) : null;
  const tables = knowledge.tables ?? [];
  const text = knowledge.rawText || knowledge.sections.map((section) => section.content).join("\n\n");
  const needsReview = Boolean(knowledge.needsReview || knowledge.reviewWarning || unclear.length || (typeof knowledge.confidence === "number" && knowledge.confidence < 0.7));
  return (
    <div className="grid w-full gap-3">
      {needsReview ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p>{knowledge.reviewWarning ?? "Some handwriting was difficult to read. Review the extracted text or try high accuracy extraction."}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
            {confidence !== null ? <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">Confidence {confidence}%</span> : null}
            {knowledge.handwritingDifficulty ? <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">Handwriting {knowledge.handwritingDifficulty}</span> : null}
            <button
              type="button"
              onClick={onHighAccuracyRetry}
              disabled={retryingHighAccuracy || highAccuracyDisabled}
              className="rounded-full bg-amber-600 px-3 py-1.5 text-white disabled:cursor-not-allowed disabled:opacity-60"
              title={highAccuracyDisabled ? "AI generation is not available in this environment." : undefined}
            >
              {retryingHighAccuracy ? "Re-extracting..." : "Re-extract with high accuracy"}
            </button>
          </div>
        </div>
      ) : null}
      <section className="premium-card premium-card-hover rounded-2xl p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--sc-primary)]">{pickerLabel}</p>
        <h2 className="mt-1 text-lg font-black text-slate-950">{pickerHeading}</h2>
        <p className="mt-1 text-sm text-slate-500">{pickerDescription}</p>
        <div className="mt-4">
          <SmartPageTemplatePicker
            templates={templates}
            scope="parsed"
            disabled={generateDisabled}
            onPickTemplate={onPickTemplate}
          />
        </div>
      </section>
      <section className="premium-card premium-card-hover rounded-2xl p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">OCR Review</p>
        <h2 className="mt-1 text-lg font-black text-slate-950">{knowledge.title || "Untitled document"}</h2>
        <p className="mt-1 text-sm text-slate-500">{knowledge.suggestedDocumentType ?? knowledge.documentType} - {knowledge.domain}</p>
      </section>
      <section className="premium-card premium-card-hover rounded-2xl p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">Extracted text</h3>
          <button type="button" className="text-xs font-bold text-blue-700" onClick={onEdit}>
            Edit extracted text
          </button>
        </div>
        {editing ? (
          <textarea
            className="min-h-[26rem] w-full resize-y rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800 outline-none focus:border-[color:var(--sc-primary)]"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
          />
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{text || "No text extracted."}</p>
        )}
        {editing ? (
          <button type="button" className="btn btn-primary mt-3 text-xs" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save review edits"}
          </button>
        ) : null}
      </section>
      {tables.length ? (
        <section className="premium-card premium-card-hover rounded-2xl p-4">
          <h3 className="text-sm font-bold text-slate-900">Detected tables</h3>
          <div className="mt-3 grid gap-3">
            {tables.map((table, index) => (
              <div key={index} className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-bold uppercase text-slate-500">{table.heading || `Table ${index + 1}`}</p>
                <p className="mt-1 text-xs text-slate-500">{table.columns.length} columns - {table.rows.length} rows</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {unclear.length ? (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-amber-200">
          <h3 className="text-sm font-bold text-amber-900">Unclear items</h3>
          <div className="mt-3 grid gap-2">
            {unclear.map((item, index) => (
              <div key={index} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-bold">{item.label}</p>
                <p className="text-xs">{item.reason}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <button
        type="button"
        className="btn btn-primary sticky bottom-3 z-10 shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onGenerate}
        disabled={generateDisabled}
        title={generateDisabled ? "AI generation is not available. You can still edit the document manually." : undefined}
      >
        {primaryActionLabel}
      </button>
    </div>
  );
}

function ExtractionProcessingCard({ sourceStatus }: { sourceStatus?: string }) {
  const steps = [
    "Reading your document...",
    "Improving image quality...",
    "Extracting handwriting and tables...",
    "Preparing review...",
  ];
  const activeIndex = sourceStatus === "PREPROCESSING" ? 1 : sourceStatus === "EXTRACTING" ? 2 : 0;
  return (
      <div className="mx-auto grid w-full max-w-md gap-4 p-4 text-center">
      <div className="premium-card premium-card-hover rounded-2xl p-5">
        <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-full bg-blue-100" />
        <h2 className="text-base font-black text-slate-950">{steps[Math.min(activeIndex, steps.length - 1)]}</h2>
        <div className="mt-4 grid gap-2 text-left">
          {steps.map((step, index) => (
            <div key={step} className={`rounded-lg px-3 py-2 text-xs font-semibold ${index <= activeIndex ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-400"}`}>
              {step}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExtractionFailedCard({ message, onRetry }: { message?: string | null; onRetry: () => void }) {
  return (
      <div className="mx-auto grid w-full max-w-md gap-3 p-4 text-center">
      <div className="premium-card premium-card-hover rounded-2xl p-5">
        <h2 className="text-base font-black text-slate-950">Extraction failed</h2>
        <p className="mt-2 text-sm text-slate-500">{message || "We could not read this document. Please retry or upload a clearer file."}</p>
        <button type="button" className="btn btn-primary mt-4" onClick={onRetry}>
          Retry extraction
        </button>
      </div>
    </div>
  );
}

function ManualDraftPanel({
  title,
  draft,
  onDraftChange,
  onSave,
  saving,
  onGenerate,
  generateDisabled,
  generateLabel,
  aiNotice,
}: {
  title: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  onGenerate: () => void;
  generateDisabled: boolean;
  generateLabel: string;
  aiNotice: string | null;
}) {
  return (
    <section className="premium-card premium-card-hover rounded-[28px] p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--sc-primary)]">Document workspace</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Edit the document directly in this workspace. AI actions stay secondary and can be skipped if the environment is not configured.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onSave} disabled={saving} className="btn btn-secondary text-xs">
            {saving ? "Saving..." : "Save draft"}
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={generateDisabled}
            className="btn btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-50"
            title={aiNotice ?? undefined}
          >
            {generateLabel}
          </button>
        </div>
      </div>
      <textarea
        className="mt-4 min-h-[22rem] w-full resize-y rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-800 outline-none focus:border-[color:var(--sc-primary)] focus:bg-white"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        aria-label="Manual document draft"
      />
    </section>
  );
}

function isMissingSchemaError(error: unknown): boolean {
  return error instanceof Error && /generate a schema first/i.test(error.message);
}

function isAiConfigurationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /GEMINI_API_KEY|Gemini is not configured|AI generation is not configured/i.test(message);
}

function buildStarterDraft(title: string, isLawyerWorkspace: boolean): string {
  return isLawyerWorkspace
    ? [
        title || "Legal draft",
        "",
        "Client / Matter:",
        "",
        "Background:",
        "",
        "Requested outcome:",
        "",
        "Key facts:",
        "",
        "Draft body:",
        "",
        "Next steps:",
        "",
        "Signature block:",
      ].join("\n")
    : [
        title || "Document draft",
        "",
        "Title:",
        "",
        "Background:",
        "",
        "Key points:",
        "",
        "Draft body:",
        "",
        "Action items:",
        "",
        "Notes:",
    ].join("\n");
}

function buildInitialDraft(
  title: string,
  isLawyerWorkspace: boolean,
  template?: SmartPageTemplateDefinition | null,
): string {
  if (isLawyerWorkspace && template) {
    return buildLawyerTemplateStarterDraft(template, title);
  }

  return buildStarterDraft(title, isLawyerWorkspace);
}

function createManualKnowledge(title: string, draft: string): ExtractedKnowledge {
  return {
    documentType: "document",
    domain: "general",
    title: title || "Manual document",
    suggestedDocumentType: "document",
    sections: draft.trim()
      ? [{ heading: "Manual text", content: draft.trim() }]
      : [{ heading: "Manual text", content: "" }],
    tables: [],
    statistics: [],
    entities: [],
    people: [],
    dates: [],
    handwrittenNotes: [],
    keyFacts: [],
    unclearItems: [],
    rawText: draft,
  };
}

// ── Version history panel ──────────────────────────────────────────────────────

function VersionPanel({
  versions,
  activeVersionId,
  onRestore,
  onClose,
}: {
  versions: DocumentVersionSummary[];
  activeVersionId: string | undefined;
  onRestore: (v: DocumentVersionSummary) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900">Version History</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {versions.map((v) => (
            <div
              key={v.id}
              className={`flex items-start justify-between gap-2 rounded-lg border p-2.5 ${
                v.id === activeVersionId ? "border-blue-300 bg-blue-50" : "border-slate-200"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-700 truncate">
                  {v.instruction ?? "Initial version"}
                </p>
                <p className="text-[10px] text-slate-400">{new Date(v.createdAt).toLocaleString()}</p>
              </div>
              {v.id !== activeVersionId ? (
                <button
                  type="button"
                  onClick={() => onRestore(v)}
                  className="shrink-0 text-[10px] font-bold text-blue-600 hover:underline"
                >
                  Restore
                </button>
              ) : (
                <span className="shrink-0 text-[10px] font-bold text-blue-500">Current</span>
              )}
            </div>
          ))}
          {versions.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">No versions yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Main editor ────────────────────────────────────────────────────────────────

type Stage = "empty" | "processing" | "uploaded" | "extractionFailed" | "generating" | "ready";
type RenderSettings = NonNullable<SmartDocumentDetail["activeVersion"]>["renderSettings"];

export function DocumentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isLawyerWorkspace = location.pathname.startsWith("/lawyers");
  const templateId = searchParams.get("template");
  const lawyerTemplate = isLawyerWorkspace && templateId ? getLawyerPageTemplateById(templateId) ?? null : null;

  const [doc, setDoc] = useState<SmartDocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  const [stage, setStage] = useState<Stage>("empty");
  const [schema, setSchema] = useState<DocumentSchema | null>(null);
  const [componentTree, setComponentTree] = useState<ComponentNode[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | undefined>();
  const [renderSettings, setRenderSettings] = useState<RenderSettings>();
  const [extractedKnowledge, setExtractedKnowledge] = useState<ExtractedKnowledge | null>(null);
  const [reviewEditing, setReviewEditing] = useState(false);
  const [reviewDraft, setReviewDraft] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [retryingHighAccuracy, setRetryingHighAccuracy] = useState(false);
  const [creatorPreferences, setCreatorPreferences] = useState<Record<string, unknown> | null>(null);

  const [versions, setVersions] = useState<DocumentVersionSummary[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [publishResult, setPublishResult] = useState<{ token: string; url: string } | null>(null);
  const [publishing, setPublishing] = useState(false);

  const [, setActiveTab] = useState<"chat" | "preview">("chat");
  const [showActions, setShowActions] = useState(false);
  const autoTemplateRef = useRef<string | null>(null);
  const hasActiveVersion = Boolean(activeVersionId);
  const parsedTemplates = isLawyerWorkspace ? getLawyerPageTemplates("parsed") : getSmartPageTemplates("parsed");
  const readyTemplates = getSmartPageTemplates("ready");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const actionLockRef = useRef<string | null>(null);
  const processingTimeoutRef = useRef<number | null>(null);
  const processingStartedAtRef = useRef<number | null>(null);

  function acquireActionLock(lock: string): boolean {
    if (actionLockRef.current) return false;
    actionLockRef.current = lock;
    return true;
  }

  function releaseActionLock(lock: string): void {
    if (actionLockRef.current === lock) {
      actionLockRef.current = null;
    }
  }

  // Load document on mount
  useEffect(() => {
    if (!id) return;
    getDocument(id)
      .then((d) => {
        setDoc(d);
        setExtractedKnowledge(d.extractedKnowledge);
        const nextDraft = d.extractedKnowledge?.rawText
          || d.extractedKnowledge?.sections.map((section) => section.content).join("\n\n")
          || buildInitialDraft(d.title, isLawyerWorkspace, lawyerTemplate);
        setReviewDraft(nextDraft);
        if (d.extractionError && isAiConfigurationError(d.extractionError)) {
          setAiNotice("AI generation is not configured in this environment. You can still edit this document manually.");
        } else if (d.latestSourceFile?.extractionError && isAiConfigurationError(d.latestSourceFile.extractionError)) {
          setAiNotice("AI generation is not configured in this environment. You can still edit this document manually.");
        }
        if (d.activeVersion) {
          setSchema(d.activeVersion.schema);
          setComponentTree(d.activeVersion.componentTree);
          setActiveVersionId(d.activeVersion.id);
          setRenderSettings(d.activeVersion.renderSettings);
          setStage("ready");
        } else if (d.extractionStatus === "PROCESSING") {
          setStage("processing");
          setActiveTab("preview");
        } else if (d.extractionStatus === "FAILED") {
          if (d.extractionError && isAiConfigurationError(d.extractionError)) {
            setStage("empty");
            setActiveTab("preview");
          } else {
            setStage("extractionFailed");
            setActiveTab("preview");
          }
        } else if (d.extractedKnowledge) {
          setStage("uploaded");
        } else {
          setStage("empty");
        }
        addSystemMessage(
          d.activeVersion
            ? `Loaded "${d.title}" - ${d.versionCount} version${d.versionCount !== 1 ? "s" : ""}. Keep editing below.`
            : d.extractedKnowledge
              ? `Content extracted from "${d.title}". Generate a document from extraction first, then keep editing below.`
              : `New document "${d.title}". Upload a file or describe what you'd like to create.`,
        );
      })
      .catch((e: Error) => setLoadError(e.message || "Failed to load document."))
      .finally(() => setLoading(false));
  }, [id, isLawyerWorkspace, lawyerTemplate]);

  useEffect(() => {
    if (!isLawyerWorkspace) return;
    listPreferences()
      .then((prefs) => {
        setCreatorPreferences(Object.fromEntries(prefs.map((pref) => [pref.key, pref.value])));
      })
      .catch(() => {
        setCreatorPreferences(null);
      });
  }, [isLawyerWorkspace]);

  useEffect(() => {
    if (typeof chatEndRef.current?.scrollIntoView === "function") {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (processingTimeoutRef.current) {
      window.clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
    if (stage !== "processing") {
      processingStartedAtRef.current = null;
      return;
    }
    processingStartedAtRef.current = Date.now();
    processingTimeoutRef.current = window.setTimeout(() => {
      if (processingStartedAtRef.current && Date.now() - processingStartedAtRef.current >= 120_000 && stage === "processing") {
        setStage("extractionFailed");
        setActiveTab("preview");
        addMessage("assistant", "Extraction is taking longer than expected. Retry extraction to try again.");
      }
    }, 120_000);
    return () => {
      if (processingTimeoutRef.current) {
        window.clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = null;
      }
    };
  }, [stage]);

  useEffect(() => {
    if (!id || stage !== "processing") return;
    const interval = window.setInterval(() => {
      void getDocument(id).then((latest) => {
        setDoc(latest);
        setExtractedKnowledge(latest.extractedKnowledge);
        if (latest.extractionStatus === "READY" && latest.extractedKnowledge) {
          setReviewDraft(latest.extractedKnowledge.rawText || latest.extractedKnowledge.sections.map((section) => section.content).join("\n\n"));
          setStage("uploaded");
          setActiveTab("preview");
          addMessage("assistant", "Your document is ready for review.");
        } else if (latest.extractionStatus === "FAILED") {
          setStage("extractionFailed");
          setActiveTab("preview");
          addMessage("assistant", latest.extractionError || "Extraction failed. You can retry from the preview panel.");
        }
      }).catch(() => undefined);
    }, 2_500);
    return () => window.clearInterval(interval);
  }, [id, stage]);

  function addMessage(role: ChatMessage["role"], content: string, extras?: Partial<ChatMessage>) {
    setMessages((prev) => [
      ...prev,
      { id: randomUUID(), role, content, timestamp: new Date().toISOString(), ...extras },
    ]);
  }

  function addSystemMessage(content: string) {
    addMessage("system", content);
  }

  // File upload handler
  async function handleFileUpload(file: File) {
    if (!id) return;
    if (!acquireActionLock("upload")) return;
    addMessage("user", `Uploading ${file.name}...`);
    setBusy(true);
    try {
      await uploadDocumentFile(id, file);
      setStage("processing");
      setExtractedKnowledge(null);
      setReviewDraft("");
      setReviewEditing(false);
      setActiveTab("preview");
      addMessage(
        "assistant",
        `Upload received. I'm reading "${file.name}" in the background now.`,
      );
      // Refresh doc to get updated title
      const refreshed = await getDocument(id);
      setDoc(refreshed);
    } catch (e) {
      if (isAiConfigurationError(e)) {
        setAiNotice("AI generation is not configured in this environment. You can still edit this document manually.");
        setStage("empty");
        setReviewDraft(buildInitialDraft(doc?.title ?? "Document draft", isLawyerWorkspace, lawyerTemplate));
      } else {
        addMessage("assistant", `Upload failed: ${e instanceof Error ? e.message : "Unknown error."}`);
      }
    } finally {
      setBusy(false);
      releaseActionLock("upload");
    }
  }

  const submitInstruction = useCallback(async (text: string, nested = false) => {
    if (!text.trim() || !id || busy) return;
    if (stage === "processing") {
      addMessage("assistant", "Still reading your document. You can generate once the review is ready.");
      return;
    }
    if (aiNotice) {
      return;
    }
    if (!nested && !acquireActionLock("submit")) return;
    addMessage("user", text);
    setBusy(true);

    try {
      const shouldGenerateFirst = stage === "uploaded" || stage === "empty" || !hasActiveVersion;
      if (shouldGenerateFirst) {
        if (stage === "empty" && !extractedKnowledge) {
          const draftText = reviewDraft.trim() ? reviewDraft : text;
          const manualKnowledge: ExtractedKnowledge = {
            documentType: "document",
            domain: "general",
            title: doc?.title ?? "Manual document",
            suggestedDocumentType: "document",
            sections: [{ heading: "Manual text", content: draftText }],
            tables: [],
            statistics: [],
            entities: [],
            people: [],
            dates: [],
            handwrittenNotes: [],
            keyFacts: [],
            unclearItems: [],
            rawText: draftText,
          };
          const saved = await updateExtractedKnowledge(id, manualKnowledge);
          setExtractedKnowledge(saved);
        }
        // First intent - generate schema
        setStage("generating");
        addMessage("assistant", "Generating your document...");
        const result = await generateSchema(id, text);
        setSchema(result.schema);
        setComponentTree(result.componentTree);
        setActiveVersionId(result.versionId);
        const refreshed = await getDocument(id);
        setDoc(refreshed);
        setRenderSettings(refreshed.activeVersion?.renderSettings);
        setStage("ready");
        setActiveTab("preview");
        addMessage("assistant", "Done! Your document is ready. Switch to Preview to see it, or keep editing here.", {
          action: "generate",
          versionId: result.versionId,
        });
        // Refresh versions
        const v = await getVersionHistory(id);
        setVersions(v);
      } else {
        try {
          const result = await applyPrompt(id, text);
          setSchema(result.schema);
          setComponentTree(result.componentTree);
          setActiveVersionId(result.versionId);
          const refreshed = await getDocument(id);
          setDoc(refreshed);
          setRenderSettings(refreshed.activeVersion?.renderSettings);
          addMessage("assistant", "Updated. Switch to Preview to see the changes.", {
            action: "edit",
            versionId: result.versionId,
          });
          setActiveTab("preview");
          // Refresh versions
          const v = await getVersionHistory(id);
          setVersions(v);
        } catch (error) {
          if (!hasActiveVersion && isMissingSchemaError(error)) {
            addMessage("assistant", "No schema existed yet, so I generated one from your extraction instead.");
            const result = await generateSchema(id, text);
            setSchema(result.schema);
            setComponentTree(result.componentTree);
            setActiveVersionId(result.versionId);
            const refreshed = await getDocument(id);
            setDoc(refreshed);
            setRenderSettings(refreshed.activeVersion?.renderSettings);
            setStage("ready");
            setActiveTab("preview");
            const v = await getVersionHistory(id);
            setVersions(v);
          } else {
            throw error;
          }
        }
      }
    } catch (e) {
      if (isAiConfigurationError(e)) {
        setAiNotice("AI generation is not configured in this environment. You can still edit this document manually.");
        setStage(hasActiveVersion ? "ready" : extractedKnowledge ? "uploaded" : "empty");
        setActiveTab("preview");
        if (!hasActiveVersion && !extractedKnowledge) {
          setReviewDraft(buildInitialDraft(doc?.title ?? "Document draft", isLawyerWorkspace, lawyerTemplate));
        }
      } else {
        addMessage("assistant", e instanceof Error ? e.message : "Something went wrong. Try again.");
      }
    } finally {
      setBusy(false);
      if (!nested) releaseActionLock("submit");
    }
  }, [id, busy, stage, extractedKnowledge, doc?.title, hasActiveVersion, aiNotice, isLawyerWorkspace, lawyerTemplate, reviewDraft]);

  // Send message handler
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await submitInstruction(text);
  }, [input, submitInstruction]);

  const handleTemplatePick = useCallback((template: SmartPageTemplateDefinition, options?: { summaryStyleId?: string }) => {
    if (!extractedKnowledge) return;
    const prompt = template.buildPrompt({
      documentTitle: doc?.title,
      extractedKnowledge,
      summaryStyleId: options?.summaryStyleId,
      preferences: creatorPreferences,
    });
    void submitInstruction([
      `Template ID: ${template.id}`,
      `Template Name: ${template.name}`,
      "",
      prompt,
    ].join("\n"));
  }, [creatorPreferences, doc?.title, extractedKnowledge, submitInstruction]);

  useEffect(() => {
    if (!isLawyerWorkspace || !id || !doc || !templateId) return;
    if (aiNotice) return;
    if (hasActiveVersion || busy || stage === "processing" || stage === "generating") return;
    if (autoTemplateRef.current === templateId) return;

    const template = getLawyerPageTemplateById(templateId);
    if (!template) return;

    autoTemplateRef.current = templateId;
    const prompt = template.buildPrompt({
      documentTitle: doc.title,
      extractedKnowledge: extractedKnowledge ?? undefined,
      preferences: creatorPreferences,
    });

    void (async () => {
      try {
        await submitInstruction([
          `Template ID: ${template.id}`,
          `Template Name: ${template.name}`,
          "",
          prompt,
        ].join("\n"));
      } finally {
        if (location.pathname === `/lawyers/documents/${id}` || location.pathname === `/lawyers/documents/${id}/`) {
          navigate(`/lawyers/documents/${id}`, { replace: true });
        } else {
          navigate(location.pathname, { replace: true });
        }
      }
    })();
  }, [aiNotice, busy, creatorPreferences, doc, extractedKnowledge, hasActiveVersion, id, isLawyerWorkspace, location.pathname, navigate, stage, submitInstruction, templateId]);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishPassword, setPublishPassword] = useState("");
  const [printing, setPrinting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"pdf" | "docx" | "markdown" | "schema" | null>(null);

  async function handleSaveExtractionReview() {
    if (!id || reviewSaving) return;
    if (!acquireActionLock("review-save")) return;
    setReviewSaving(true);
    try {
      const baseKnowledge = extractedKnowledge ?? createManualKnowledge(doc?.title ?? "Manual document", reviewDraft);
      const updated: ExtractedKnowledge = {
        ...baseKnowledge,
        rawText: reviewDraft,
        sections: reviewDraft.trim()
          ? [{ heading: "Reviewed text", content: reviewDraft.trim() }]
          : baseKnowledge.sections,
        unclearItems: [],
        reviewWarning: undefined,
      };
      const saved = await updateExtractedKnowledge(id, updated);
      setExtractedKnowledge(saved);
      setReviewEditing(false);
      setStage(hasActiveVersion ? "ready" : "uploaded");
      const refreshed = await getDocument(id);
      setDoc(refreshed);
      setReviewDraft(refreshed.extractedKnowledge?.rawText || refreshed.extractedKnowledge?.sections.map((section) => section.content).join("\n\n") || buildInitialDraft(refreshed.title, isLawyerWorkspace, lawyerTemplate));
      addMessage("assistant", "Saved your extraction edits. You can generate the document when it looks right.");
    } catch (e) {
      addMessage("assistant", e instanceof Error ? e.message : "Could not save the extraction edits.");
    } finally {
      setReviewSaving(false);
      releaseActionLock("review-save");
    }
  }

  async function handleGenerateFromReview() {
    if (!acquireActionLock("generate")) return;
    try {
      if (reviewEditing || !extractedKnowledge) await handleSaveExtractionReview();
      await submitInstruction("Generate a professional document from the reviewed extraction. Preserve all tables and key facts.", true);
    } finally {
      releaseActionLock("generate");
    }
  }

  async function handleRetryExtraction(highAccuracy = false) {
    if (!id) return;
    if (!acquireActionLock("retry")) return;
    if (highAccuracy) setRetryingHighAccuracy(true);
    try {
      await retryDocumentExtraction(id, doc?.latestSourceFile?.id, { highAccuracy });
      setStage("processing");
      setActiveTab("preview");
      const refreshed = await getDocument(id);
      setDoc(refreshed);
      addMessage("assistant", highAccuracy ? "Retrying extraction with high accuracy in the background." : "Retrying extraction in the background.");
    } catch (e) {
      if (isAiConfigurationError(e)) {
        setAiNotice("AI generation is not configured in this environment. You can still edit this document manually.");
        setStage(extractedKnowledge ? "uploaded" : "empty");
        setActiveTab("preview");
      } else {
        addMessage("assistant", e instanceof Error ? e.message : "Retry failed.");
      }
    } finally {
      if (highAccuracy) setRetryingHighAccuracy(false);
      releaseActionLock("retry");
    }
  }

  async function handlePublish(password?: string) {
    if (!id || publishing) return;
    if (!hasActiveVersion) {
      addMessage("assistant", "Generate a document first before publishing.");
      return;
    }
    if (!acquireActionLock("publish")) return;
    setPublishing(true);
    setShowPublishModal(false);
    try {
      const result = await publishDocument(id, password ? { password } : {});
      setPublishResult(result);
      const refreshed = await getDocument(id);
      setDoc(refreshed);
      const history = await getVersionHistory(id);
      setVersions(history);
      addMessage("assistant", `Published! Your document is live at:\n${result.url}\nToken: ${result.token}${password ? "\nPassword protected." : ""}`, { action: "publish" });
    } catch (e) {
      addMessage("assistant", e instanceof Error ? e.message : "Publish failed.");
    } finally {
      setPublishing(false);
      setPublishPassword("");
      releaseActionLock("publish");
    }
  }

  async function handlePrint() {
    if (!id || printing) return;
    if (!hasActiveVersion) {
      addMessage("assistant", "Generate a document first before printing.");
      return;
    }
    if (!acquireActionLock("print")) return;
    setPrinting(true);
    try {
      await openPrintWindow(id);
    } catch (e) {
      addMessage("assistant", e instanceof Error ? e.message : "Print failed.");
    } finally {
      setPrinting(false);
      releaseActionLock("print");
    }
  }

  async function handleDownloadExport(format: "pdf" | "docx" | "markdown" | "schema") {
    if (!id || exportingFormat) return;
    if (!hasActiveVersion) {
      addMessage("assistant", "Generate a document first before downloading.");
      return;
    }
    if (!acquireActionLock(`export-${format}`)) return;
    setExportingFormat(format);
    try {
      await downloadDocumentExport(id, format);
      addMessage("assistant", `${format.toUpperCase()} download started.`, { action: "generate" });
    } catch (e) {
      addMessage("assistant", e instanceof Error ? e.message : `Could not download ${format.toUpperCase()}.`);
    } finally {
      setExportingFormat(null);
      releaseActionLock(`export-${format}`);
    }
  }

  async function handleVersionRestore(v: DocumentVersionSummary) {
    if (!id) return;
    setShowVersions(false);
    try {
      await restoreVersion(id, v.id);
      // Reload doc to get restored version schema
      const refreshed = await getDocument(id);
      if (refreshed.activeVersion) {
        setSchema(refreshed.activeVersion.schema);
        setComponentTree(refreshed.activeVersion.componentTree);
        setActiveVersionId(refreshed.activeVersion.id);
        setRenderSettings(refreshed.activeVersion.renderSettings);
      }
      const history = await getVersionHistory(id);
      setVersions(history);
      addMessage("assistant", `Restored to: "${v.instruction ?? "initial version"}".`, {
        action: "restore",
        versionId: v.id,
      });
    } catch (e) {
      addMessage("assistant", e instanceof Error ? e.message : "Restore failed.");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-slate-500">Loading document...</p>
      </div>
    );
  }

  if (loadError || !doc) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <p className="text-sm text-red-600">{loadError || "Document not found."}</p>
        <button type="button" className="btn btn-primary mt-4" onClick={() => void navigate(isLawyerWorkspace ? "/lawyers/dashboard" : "/smart-pages")}>
          Back to Documents
        </button>
      </div>
    );
  }

  const currentSchema = schema ?? { theme: DEFAULT_THEME, components: [] };
  const suggestions = stage === "ready" ? POST_GENERATE_SUGGESTIONS : INITIAL_SUGGESTIONS;
  const extractionPrimaryActionLabel = hasActiveVersion
    ? isLawyerWorkspace
      ? "Looks good, generate legal draft"
      : "Looks good, generate document"
    : isLawyerWorkspace
      ? "Generate legal draft from extraction."
      : "Generate document from extraction.";
  const stageLabel =
    stage === "ready"
      ? "Ready"
      : stage === "uploaded"
        ? "Review extraction"
        : stage === "processing"
          ? "Reading file"
          : stage === "generating"
            ? "Generating"
            : stage === "extractionFailed"
              ? "Extraction failed"
              : "Draft";

  return (
    <div className="relative flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-slate-100">
      <div className="border-b border-slate-200 bg-white">
        <div className="flex min-h-10 items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => void navigate(isLawyerWorkspace ? "/lawyers/dashboard" : "/smart-pages")}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Back to documents"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">
            {doc.title}
          </h1>
          {stage === "ready" && hasActiveVersion ? (
            <span className="hidden rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 sm:inline-flex">
              {componentTree.length} components
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
            {stageLabel}
          </span>
          {stage === "ready" && hasActiveVersion ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              {componentTree.length} components
            </span>
          ) : null}
          {aiNotice ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
              AI unavailable
            </span>
          ) : null}
          {publishResult ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
              Published secure link ready
            </span>
          ) : null}
        </div>
      </div>

      {isLawyerWorkspace ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900">
          Generated documents are drafts and must be reviewed by a qualified legal professional before use.
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid min-h-full gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <main className="min-w-0 space-y-4">
            <section className="premium-card premium-card-hover rounded-[28px] p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void navigate(isLawyerWorkspace ? "/lawyers/dashboard" : "/smart-pages")}
                  className="btn btn-secondary text-xs"
                >
                  Back to documents
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveExtractionReview()}
                  className="btn btn-secondary text-xs"
                  disabled={reviewSaving}
                >
                  {reviewSaving ? "Saving..." : "Save draft"}
                </button>
                <button
                  type="button"
                  onClick={() => { void getVersionHistory(id!).then(setVersions); setShowVersions(true); }}
                  className="btn btn-secondary text-xs"
                  disabled={versions.length === 0 && !hasActiveVersion}
                  title={versions.length === 0 && !hasActiveVersion ? "No saved versions yet." : undefined}
                >
                  Version history
                </button>
                <button
                  type="button"
                  onClick={() => void handlePrint()}
                  disabled={printing || !hasActiveVersion}
                  className="btn btn-secondary text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  title={!hasActiveVersion ? "Generate a first version before printing." : undefined}
                >
                  {printing ? "Opening..." : "Print"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownloadExport("pdf")}
                  disabled={exportingFormat === "pdf" || !hasActiveVersion}
                  className="btn btn-secondary text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  title={!hasActiveVersion ? "Generate a first version before downloading." : undefined}
                >
                  {exportingFormat === "pdf" ? "Downloading..." : "Download PDF"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownloadExport("docx")}
                  disabled={exportingFormat === "docx" || !hasActiveVersion}
                  className="btn btn-secondary text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  title={!hasActiveVersion ? "Generate a first version before downloading." : undefined}
                >
                  {exportingFormat === "docx" ? "Downloading..." : "Download DOCX"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownloadExport("markdown")}
                  disabled={exportingFormat === "markdown" || !hasActiveVersion}
                  className="btn btn-secondary text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  title={!hasActiveVersion ? "Generate a first version before exporting." : undefined}
                >
                  {exportingFormat === "markdown" ? "Downloading..." : "Export Markdown"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownloadExport("schema")}
                  disabled={exportingFormat === "schema" || !hasActiveVersion}
                  className="btn btn-secondary text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  title={!hasActiveVersion ? "Generate a first version before exporting." : undefined}
                >
                  {exportingFormat === "schema" ? "Downloading..." : "Export Schema"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPublishModal(true)}
                  disabled={publishing || !hasActiveVersion}
                  className="btn btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  title={!hasActiveVersion ? "Generate a first version before publishing." : undefined}
                >
                  {publishing ? "Publishing..." : publishResult ? "Re-publish Secure Link" : "Publish Secure Link"}
                </button>
              </div>
            </section>

            {stage === "processing" ? (
              <div className="flex min-h-[24rem] items-center justify-center">
                <ExtractionProcessingCard sourceStatus={doc.latestSourceFile?.status} />
              </div>
            ) : stage === "extractionFailed" ? (
              <div className="flex min-h-[24rem] items-center justify-center">
                <ExtractionFailedCard message={doc.extractionError ?? doc.latestSourceFile?.extractionError} onRetry={() => void handleRetryExtraction()} />
              </div>
            ) : stage === "uploaded" && extractedKnowledge ? (
              <ExtractionReviewPanel
                knowledge={extractedKnowledge}
                editing={reviewEditing}
                draft={reviewDraft}
                saving={reviewSaving}
                onEdit={() => setReviewEditing(true)}
                onDraftChange={setReviewDraft}
                onSave={() => void handleSaveExtractionReview()}
                onGenerate={() => void handleGenerateFromReview()}
                generateDisabled={Boolean(aiNotice)}
                templates={parsedTemplates}
                onPickTemplate={handleTemplatePick}
                onHighAccuracyRetry={() => void handleRetryExtraction(true)}
                highAccuracyDisabled={Boolean(aiNotice)}
                retryingHighAccuracy={retryingHighAccuracy}
                primaryActionLabel={extractionPrimaryActionLabel}
                pickerLabel={isLawyerWorkspace ? "What would you like to create from this legal material?" : "What would you like to create?"}
                pickerHeading={isLawyerWorkspace ? "Choose a legal drafting template" : "Choose a processing template"}
                pickerDescription={isLawyerWorkspace ? "Pick a structure for the parsed legal material and keep the output editable before export." : "Pick how the parsed content should be turned into an editable output."}
              />
            ) : stage === "empty" ? (
              <ManualDraftPanel
                title={doc.title || (isLawyerWorkspace ? "Legal draft workspace" : "Document draft workspace")}
                draft={reviewDraft}
                onDraftChange={setReviewDraft}
                onSave={() => void handleSaveExtractionReview()}
                saving={reviewSaving}
                onGenerate={() => void handleGenerateFromReview()}
                generateDisabled={Boolean(aiNotice)}
                generateLabel={isLawyerWorkspace ? "Generate legal draft" : "Generate document"}
                aiNotice={aiNotice}
              />
            ) : stage === "ready" && hasActiveVersion ? (
              <>
                <ManualDraftPanel
                  title={doc.title || (isLawyerWorkspace ? "Legal draft workspace" : "Document draft workspace")}
                  draft={reviewDraft}
                  onDraftChange={setReviewDraft}
                  onSave={() => void handleSaveExtractionReview()}
                  saving={reviewSaving}
                  onGenerate={() => void handleGenerateFromReview()}
                  generateDisabled={Boolean(aiNotice)}
                  generateLabel={isLawyerWorkspace ? "Regenerate legal draft" : "Update document"}
                  aiNotice={aiNotice}
                />
                {readyTemplates.length > 0 ? (
                  <section className="premium-card premium-card-hover rounded-[28px] p-4 sm:p-6">
                    <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--sc-primary)]">Delivery options</p>
                    <h3 className="mt-1 text-sm font-black text-slate-950">Publish or hand off the finished Smart Page</h3>
                    <div className="mt-3">
                      <SmartPageTemplatePicker
                        templates={readyTemplates}
                        scope="ready"
                        disabled={Boolean(aiNotice)}
                        onPickTemplate={(template) => {
                          if (template.id === "publish-secure-link") {
                            setShowPublishModal(true);
                          }
                        }}
                      />
                    </div>
                  </section>
                ) : null}
                <section className="premium-card premium-card-hover rounded-[28px] p-4 sm:p-6">
                  {publishResult ? (
                    <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <p className="text-xs font-bold text-emerald-700">Published</p>
                      <p className="mt-0.5 break-all text-xs text-emerald-600">{publishResult.url}</p>
                      <p className="mt-1 break-all text-[10px] font-semibold text-emerald-700">Token: {publishResult.token}</p>
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(publishResult.url)}
                        className="mt-1.5 text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        Copy link
                      </button>
                    </div>
                  ) : null}
                  <DocumentPreview schema={currentSchema} componentTree={componentTree} renderSettings={renderSettings} />
                </section>
              </>
            ) : stage === "generating" ? (
              <div className="flex min-h-[24rem] items-center justify-center">
                <ExtractionProcessingCard sourceStatus="EXTRACTING" />
              </div>
            ) : null}
          </main>

          <aside className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
            <section className="premium-card premium-card-hover rounded-[28px] p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--sc-primary)]">AI assistant</p>
                  <h2 className="mt-1 text-sm font-black text-slate-950">Smart actions and guidance</h2>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setShowActions((value) => !value)}
                  disabled={Boolean(aiNotice)}
                  title={aiNotice ?? undefined}
                >
                  {showActions ? "Hide" : "Show"} actions
                </button>
              </div>
              {aiNotice ? (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {aiNotice}
                </div>
              ) : stage === "processing" ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Reading the document in the background. You can keep editing the draft below once parsing is ready.
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                  Use the draft editor first, then ask AI to polish, summarize, or reformat the document when needed.
                </div>
              )}
            </section>

            <section className="premium-card premium-card-hover rounded-[28px] p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-black text-slate-950">Assistant messages</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                  {messages.length}
                </span>
              </div>
              <div className="mt-3 max-h-[24rem] space-y-3 overflow-y-auto pr-1">
                {messages.length > 0 ? messages.map((msg) => <ChatBubble key={msg.id} msg={msg} />) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                    Messages from AI and system events will appear here.
                  </p>
                )}
                {busy ? (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
                      <span className="inline-flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                      </span>
                    </div>
                  </div>
                ) : null}
                <div ref={chatEndRef} />
              </div>
            </section>

            <section className="premium-card premium-card-hover rounded-[28px] p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-black text-slate-950">Assistant actions</h3>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setShowActions((value) => !value)}
                  disabled={Boolean(aiNotice)}
                  title={aiNotice ?? undefined}
                >
                  {showActions ? "Hide" : "Show"} actions
                </button>
              </div>
              {showActions ? (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SuggestionChips
                      items={suggestions}
                      disabled={Boolean(aiNotice)}
                      onSelect={(s) => {
                        if (!aiNotice) setInput(s);
                      }}
                    />
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <button
                      type="button"
                      title="Upload file"
                      className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-40"
                      disabled={busy}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,application/pdf,.xls,.xlsx,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleFileUpload(file);
                        e.target.value = "";
                      }}
                    />
                    <textarea
                      rows={2}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleSend();
                        }
                      }}
                      placeholder={
                        aiNotice
                          ? "AI is unavailable. Edit the draft on the left."
                          : stage === "empty"
                            ? "Describe what you'd like to create?"
                            : stage === "processing"
                              ? "Reading your document..."
                              : stage === "uploaded"
                                ? "Describe how you want this document to look?"
                                : "Edit the document: make it formal, add charts, translate..."
                      }
                      className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[color:var(--sc-primary)] focus:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={busy || stage === "processing" || Boolean(aiNotice)}
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded-xl bg-[color:var(--sc-primary)] p-2.5 text-white hover:bg-[color:var(--sc-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={busy || stage === "processing" || !input.trim() || Boolean(aiNotice)}
                      onClick={() => void handleSend()}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m22 2-7 20-4-9-9-4Z" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M22 2 11 13" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  Open actions to use template prompts or ask AI to reshape the draft. Manual editing stays available on the left.
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>

      {/* Version history modal */}
      {showVersions ? (
        <VersionPanel
          versions={versions}
          activeVersionId={activeVersionId}
          onRestore={(v) => void handleVersionRestore(v)}
          onClose={() => setShowVersions(false)}
        />
      ) : null}

      {/* Publish modal */}
      {showPublishModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-black text-slate-900">Publish Document</h2>
            <p className="mt-1 text-sm text-slate-500">Create a shareable link. Optionally add a password.</p>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-slate-600">Password (optional)</label>
              <input
                type="password"
                placeholder="Leave empty for public link"
                value={publishPassword}
                onChange={(e) => setPublishPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => { setShowPublishModal(false); setPublishPassword(""); }}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handlePublish(publishPassword || undefined)}
                className="btn btn-primary flex-1"
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

