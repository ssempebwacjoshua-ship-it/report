import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  applyPrompt,
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
import { DocumentPreview } from "../../components/smart-pages/DocumentPreview";
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

function SuggestionChips({ items, onSelect }: { items: string[]; onSelect: (s: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-2">
      {items.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onSelect(s)}
          className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
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
}: {
  knowledge: ExtractedKnowledge;
  editing: boolean;
  draft: string;
  saving: boolean;
  onEdit: () => void;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onGenerate: () => void;
}) {
  const unclear = knowledge.unclearItems ?? [];
  const tables = knowledge.tables ?? [];
  const text = knowledge.rawText || knowledge.sections.map((section) => section.content).join("\n\n");
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-3 p-4">
      {knowledge.reviewWarning || unclear.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {knowledge.reviewWarning ?? "Some handwriting was unclear. Please review before publishing."}
        </div>
      ) : null}
      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">OCR Review</p>
        <h2 className="mt-1 text-lg font-black text-slate-950">{knowledge.title || "Untitled document"}</h2>
        <p className="mt-1 text-sm text-slate-500">{knowledge.suggestedDocumentType ?? knowledge.documentType} - {knowledge.domain}</p>
      </section>
      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">Extracted text</h3>
          <button type="button" className="text-xs font-bold text-blue-700" onClick={onEdit}>
            Edit extracted text
          </button>
        </div>
        {editing ? (
          <textarea
            className="min-h-48 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-800 outline-none focus:border-blue-400"
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
        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
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
        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-amber-200">
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
      <button type="button" className="btn btn-primary sticky bottom-3 z-10 shadow-lg" onClick={onGenerate}>
        Looks good, generate document
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
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
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
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-red-200">
        <h2 className="text-base font-black text-slate-950">Extraction failed</h2>
        <p className="mt-2 text-sm text-slate-500">{message || "We could not read this document. Please retry or upload a clearer file."}</p>
        <button type="button" className="btn btn-primary mt-4" onClick={onRetry}>
          Retry extraction
        </button>
      </div>
    </div>
  );
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

  const [doc, setDoc] = useState<SmartDocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const [stage, setStage] = useState<Stage>("empty");
  const [schema, setSchema] = useState<DocumentSchema | null>(null);
  const [componentTree, setComponentTree] = useState<ComponentNode[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | undefined>();
  const [renderSettings, setRenderSettings] = useState<RenderSettings>();
  const [extractedKnowledge, setExtractedKnowledge] = useState<ExtractedKnowledge | null>(null);
  const [reviewEditing, setReviewEditing] = useState(false);
  const [reviewDraft, setReviewDraft] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  const [versions, setVersions] = useState<DocumentVersionSummary[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [publishResult, setPublishResult] = useState<{ token: string; url: string } | null>(null);
  const [publishing, setPublishing] = useState(false);

  const [activeTab, setActiveTab] = useState<"chat" | "preview">("chat");
  const [showActions, setShowActions] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load document on mount
  useEffect(() => {
    if (!id) return;
    getDocument(id)
      .then((d) => {
        setDoc(d);
        setExtractedKnowledge(d.extractedKnowledge);
        setReviewDraft(d.extractedKnowledge?.rawText || d.extractedKnowledge?.sections.map((section) => section.content).join("\n\n") || "");
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
          setStage("extractionFailed");
          setActiveTab("preview");
        } else if (d.extractedKnowledge) {
          setStage("uploaded");
        }
        addSystemMessage(
          d.activeVersion
            ? `Loaded "${d.title}" — ${d.versionCount} version${d.versionCount !== 1 ? "s" : ""}. Keep editing below.`
            : d.extractedKnowledge
              ? `Content extracted from "${d.title}". Describe how you'd like the document to look.`
              : `New document "${d.title}". Upload a file or describe what you'd like to create.`,
        );
      })
      .catch((e: Error) => setLoadError(e.message || "Failed to load document."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    addMessage("user", `Uploading ${file.name}…`);
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
      addMessage("assistant", `Upload failed: ${e instanceof Error ? e.message : "Unknown error."}`);
    } finally {
      setBusy(false);
    }
  }

  const submitInstruction = useCallback(async (text: string) => {
    if (!text.trim() || !id || busy) return;
    if (stage === "processing") {
      addMessage("assistant", "Still reading your document. You can generate once the review is ready.");
      return;
    }
    addMessage("user", text);
    setBusy(true);

    try {
      if (stage === "uploaded" || stage === "empty") {
        if (stage === "empty" && !extractedKnowledge) {
          const manualKnowledge: ExtractedKnowledge = {
            documentType: "document",
            domain: "general",
            title: doc?.title ?? "Manual document",
            suggestedDocumentType: "document",
            sections: [{ heading: "Manual text", content: text }],
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
          const saved = await updateExtractedKnowledge(id, manualKnowledge);
          setExtractedKnowledge(saved);
        }
        // First intent → generate schema
        setStage("generating");
        addMessage("assistant", "Generating your document…");
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
        // Subsequent prompts → apply edit
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
      }
    } catch (e) {
      addMessage("assistant", e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }, [id, busy, stage, extractedKnowledge, doc?.title]);

  // Send message handler
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await submitInstruction(text);
  }, [input, submitInstruction]);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishPassword, setPublishPassword] = useState("");
  const [printing, setPrinting] = useState(false);

  async function handleSaveExtractionReview() {
    if (!id || !extractedKnowledge || reviewSaving) return;
    setReviewSaving(true);
    try {
      const updated: ExtractedKnowledge = {
        ...extractedKnowledge,
        rawText: reviewDraft,
        sections: reviewDraft.trim()
          ? [{ heading: "Reviewed text", content: reviewDraft.trim() }]
          : extractedKnowledge.sections,
        unclearItems: [],
        reviewWarning: undefined,
      };
      const saved = await updateExtractedKnowledge(id, updated);
      setExtractedKnowledge(saved);
      setReviewEditing(false);
      const refreshed = await getDocument(id);
      setDoc(refreshed);
      addMessage("assistant", "Saved your extraction edits. You can generate the document when it looks right.");
    } catch (e) {
      addMessage("assistant", e instanceof Error ? e.message : "Could not save the extraction edits.");
    } finally {
      setReviewSaving(false);
    }
  }

  async function handleGenerateFromReview() {
    if (reviewEditing) await handleSaveExtractionReview();
    await submitInstruction("Generate a professional document from the reviewed extraction. Preserve all tables and key facts.");
  }

  async function handleRetryExtraction() {
    if (!id) return;
    try {
      await retryDocumentExtraction(id, doc?.latestSourceFile?.id);
      setStage("processing");
      setActiveTab("preview");
      const refreshed = await getDocument(id);
      setDoc(refreshed);
      addMessage("assistant", "Retrying extraction in the background.");
    } catch (e) {
      addMessage("assistant", e instanceof Error ? e.message : "Retry failed.");
    }
  }

  async function handlePublish(password?: string) {
    if (!id || publishing) return;
    setPublishing(true);
    setShowPublishModal(false);
    try {
      const result = await publishDocument(id, password ? { password } : {});
      setPublishResult(result);
      addMessage("assistant", `Published! Your document is live at:\n${result.url}${password ? "\n🔒 Password protected." : ""}`, { action: "publish" });
    } catch (e) {
      addMessage("assistant", e instanceof Error ? e.message : "Publish failed.");
    } finally {
      setPublishing(false);
      setPublishPassword("");
    }
  }

  async function handlePrint() {
    if (!id || printing) return;
    setPrinting(true);
    try {
      await openPrintWindow(id);
    } catch (e) {
      addMessage("assistant", e instanceof Error ? e.message : "Print failed.");
    } finally {
      setPrinting(false);
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
        <p className="text-sm text-slate-500">Loading document…</p>
      </div>
    );
  }

  if (loadError || !doc) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <p className="text-sm text-red-600">{loadError || "Document not found."}</p>
        <button type="button" className="btn btn-primary mt-4" onClick={() => void navigate("/smart-pages")}>
          Back to Documents
        </button>
      </div>
    );
  }

  const currentSchema = schema ?? { theme: DEFAULT_THEME, components: [] };
  const suggestions = stage === "ready" ? POST_GENERATE_SUGGESTIONS : INITIAL_SUGGESTIONS;
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
    <div className="relative flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white">
        <div className="flex min-h-10 items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => void navigate("/smart-pages")}
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
          {stage === "ready" ? (
            <span className="hidden rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 sm:inline-flex">
              {componentTree.length} components
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 px-3 pb-2 lg:hidden">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
            {stageLabel}
          </span>
          {stage === "ready" ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              {componentTree.length} components
            </span>
          ) : null}
        </div>

        <div className="hidden">
          {versions.length > 0 ? (
            <button
              type="button"
              onClick={() => { void getVersionHistory(id!).then(setVersions); setShowVersions(true); }}
              className="hidden text-xs font-semibold text-slate-500 hover:text-slate-800 sm:block"
            >
              History
            </button>
          ) : null}
          {stage === "ready" ? (
            <>
              <button
                type="button"
                onClick={() => void handlePrint()}
                disabled={printing}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {printing ? "Opening…" : "Print / PDF"}
              </button>
              <button
                type="button"
                onClick={() => setShowPublishModal(true)}
                disabled={publishing}
                className="btn btn-primary text-xs"
              >
                {publishing ? "Publishing…" : publishResult ? "Re-publish" : "Publish"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Mobile tab switcher */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur lg:hidden">
        <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1 shadow-inner shadow-slate-900/5">
          {(["chat", "preview"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl py-2 text-sm font-semibold capitalize transition ${
                activeTab === tab
                  ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main content: chat (left) + preview (right) */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Chat panel */}
        <div
          className={`flex flex-col ${activeTab === "chat" ? "flex" : "hidden"} w-full border-r border-slate-200 bg-slate-50 lg:flex lg:w-[400px] lg:shrink-0`}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 p-4">
            {messages.map((msg) => <ChatBubble key={msg.id} msg={msg} />)}
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

          {/* Suggestion chips */}
          {!busy && messages.length > 0 ? (
            <SuggestionChips
              items={suggestions}
              onSelect={(s) => { setInput(s); }}
            />
          ) : null}

          {/* Input area */}
          <div className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-end gap-2">
              {/* File upload button */}
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
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                  e.target.value = "";
                }}
              />

              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={
                  stage === "empty"
                    ? "Upload a file or describe what you'd like to create…"
                    : stage === "processing"
                      ? "Reading your document..."
                    : stage === "uploaded"
                      ? "Describe how you want this document to look…"
                      : "Edit the document: Make it formal, add charts, translate…"
                }
                className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white"
                disabled={busy || stage === "processing"}
              />

              <button
                type="button"
                className="shrink-0 rounded-xl bg-blue-600 p-2.5 text-white disabled:opacity-40 hover:bg-blue-700"
                disabled={busy || stage === "processing" || !input.trim()}
                onClick={() => void handleSend()}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m22 2-7 20-4-9-9-4Z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M22 2 11 13" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Preview panel */}
        <div
          className={`${activeTab === "preview" ? "flex" : "hidden"} min-w-0 flex-1 flex-col overflow-y-auto bg-slate-100 lg:flex`}
        >
          {stage === "processing" ? (
            <div className="flex flex-1 items-center justify-center">
              <ExtractionProcessingCard sourceStatus={doc.latestSourceFile?.status} />
            </div>
          ) : stage === "extractionFailed" ? (
            <div className="flex flex-1 items-center justify-center">
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
            />
          ) : stage === "ready" ? (
            <div className="min-h-full p-4">
              <div className="mx-auto max-w-2xl">
                {publishResult ? (
                  <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-bold text-emerald-700">Published</p>
                    <p className="mt-0.5 break-all text-xs text-emerald-600">{publishResult.url}</p>
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
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-white grid place-items-center shadow-sm">
                  <svg viewBox="0 0 24 24" className="h-7 w-7 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z" />
                    <path d="M14 2v6h6" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-400">
                  {stage === "generating" ? "Generating…" : "Preview will appear here"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {stage === "ready" ? (
        <div className="fixed inset-x-3 bottom-3 z-40 print:hidden lg:inset-x-auto lg:bottom-4 lg:right-4">
          {showActions ? (
            <div className="mb-2 grid w-full gap-1 rounded-2xl border border-slate-200 bg-white p-2 text-sm shadow-xl lg:min-w-40">
              {versions.length > 0 ? (
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-left font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    void getVersionHistory(id!).then(setVersions);
                    setShowVersions(true);
                    setShowActions(false);
                  }}
                >
                  History
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-xl px-3 py-2 text-left font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => { setShowActions(false); void handlePrint(); }}
                disabled={printing}
              >
                {printing ? "Opening..." : "Print / PDF"}
              </button>
              <button
                type="button"
                className="rounded-xl px-3 py-2 text-left font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => { setShowActions(false); setShowPublishModal(true); }}
                disabled={publishing}
              >
                {publishing ? "Publishing..." : publishResult ? "Re-publish" : "Publish"}
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="flex w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-xl shadow-blue-900/20 hover:bg-blue-700 lg:w-auto"
            onClick={() => setShowActions((value) => !value)}
            aria-expanded={showActions}
          >
            Actions
          </button>
        </div>
      ) : null}

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
