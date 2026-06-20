import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  createManualDocumentVersion,
  downloadDocumentExport,
  getDocument,
  getVersionHistory,
  openPrintWindow,
  publishDocument,
  requestLawyerDocumentEditPlan,
  restoreVersion,
  updateExtractedKnowledge,
} from "../../client/documentIntelligenceClient";
import { listPreferences } from "../../client/documentOsClient";
import { DocumentPreview } from "../../components/smart-pages/DocumentPreview";
import { applyDocumentPatches, parseAiEditResponse } from "../../shared/documentPatch";
import {
  buildLawyerTemplateStarterDraft,
  getLawyerPageTemplateById,
  getLawyerPageTemplates,
} from "../../shared/lawyerTemplates";
import type { SmartPageTemplateDefinition } from "../../shared/smartPagesTemplates";
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

type Stage = "empty" | "generating" | "ready";
type RenderSettings = NonNullable<SmartDocumentDetail["activeVersion"]>["renderSettings"];

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl sm:max-w-sm sm:rounded-2xl sm:p-4">
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
                <p className="truncate text-xs font-medium text-slate-700">{v.instruction ?? "Initial version"}</p>
                <p className="text-[10px] text-slate-400">{new Date(v.createdAt).toLocaleString()}</p>
              </div>
              {v.id !== activeVersionId ? (
                <button type="button" onClick={() => onRestore(v)} className="shrink-0 text-[10px] font-bold text-blue-600 hover:underline">
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

// ── Lawyer template picker ────────────────────────────────────────────────────

function LawyerTemplatePicker({
  templates,
  onPick,
  disabled,
}: {
  templates: SmartPageTemplateDefinition[];
  onPick: (template: SmartPageTemplateDefinition) => void;
  disabled: boolean;
}) {
  if (templates.length === 0) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {templates.map((template) => (
        <button
          key={template.id}
          type="button"
          disabled={disabled}
          onClick={() => onPick(template)}
          className="rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[color:var(--sc-primary)] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--sc-primary)]">{template.category}</p>
          <p className="mt-1 text-sm font-black text-slate-950">{template.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">{template.description}</p>
        </button>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function createManualKnowledge(title: string, draft: string): ExtractedKnowledge {
  return {
    documentType: "legal document",
    domain: "legal",
    title: title || "Legal draft",
    suggestedDocumentType: "legal document",
    sections: draft.trim()
      ? [{ heading: "Draft", content: draft.trim() }]
      : [{ heading: "Draft", content: "" }],
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

function buildStarterDraft(title: string): string {
  return [
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
    "",
    "Review note:",
    "AI generation is optional. You can keep editing this draft manually.",
  ].join("\n");
}

const DRAFT_SUGGESTIONS = ["Add a signature block", "Tighten the deadline", "Make it more formal", "Clarify the parties"];
const READY_SUGGESTIONS = ["Add a summary section", "Restructure the draft", "Add exhibit references", "Make it more concise"];

// ── Main component ────────────────────────────────────────────────────────────

export function LawyerDocumentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("template");

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
  const [reviewDraft, setReviewDraft] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [creatorPreferences, setCreatorPreferences] = useState<Record<string, unknown> | null>(null);

  const [lawyerTemplates] = useState<SmartPageTemplateDefinition[]>(() => getLawyerPageTemplates("parsed"));

  const [versions, setVersions] = useState<DocumentVersionSummary[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [publishResult, setPublishResult] = useState<{ token: string; url: string } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishPassword, setPublishPassword] = useState("");
  const [printing, setPrinting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"pdf" | "docx" | "markdown" | "schema" | null>(null);
  const [showActions, setShowActions] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const actionLockRef = useRef<string | null>(null);
  const hasActiveVersion = Boolean(activeVersionId);
  const aiActionsDisabled = Boolean(aiNotice);
  const suggestions = stage === "ready" ? READY_SUGGESTIONS : DRAFT_SUGGESTIONS;

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

  function addMessage(role: ChatMessage["role"], content: string, extras?: Partial<ChatMessage>) {
    setMessages((prev) => [
      ...prev,
      { id: randomUUID(), role, content, timestamp: new Date().toISOString(), ...extras },
    ]);
  }

  // Load document on mount
  useEffect(() => {
    if (!id) return;
    getDocument(id, { authMode: "creator" })
      .then((d) => {
        setDoc(d);
        const extractionErr = d.latestSourceFile?.extractionError ?? "";
        if (extractionErr && /GEMINI_API_KEY|Gemini is not configured|AI generation is not configured/i.test(extractionErr)) {
          setAiNotice("AI actions are disabled because Gemini is not configured in this environment. You can still edit, save, preview, print, and download.");
        }
        if (d.activeVersion) {
          setSchema(d.activeVersion.schema);
          setComponentTree(d.activeVersion.componentTree);
          setActiveVersionId(d.activeVersion.id);
          setRenderSettings(d.activeVersion.renderSettings);
          setStage("ready");
          setReviewDraft(d.extractedKnowledge?.rawText || d.extractedKnowledge?.sections.map((s) => s.content).join("\n\n") || buildStarterDraft(d.title));
          addMessage("system", `Loaded "${d.title}" — ${d.versionCount} version${d.versionCount !== 1 ? "s" : ""}. Keep editing below.`);
        } else {
          const template = templateId ? getLawyerPageTemplateById(templateId) ?? null : null;
          const draft = template
            ? buildLawyerTemplateStarterDraft(template, d.title)
            : (d.extractedKnowledge?.rawText || d.extractedKnowledge?.sections.map((s) => s.content).join("\n\n") || buildStarterDraft(d.title));
          setReviewDraft(draft);
          setStage("empty");
          addMessage("system", `Loaded "${d.title}" as an editable legal draft. Keep the starter content open on the left and use AI only when needed.`);
        }
      })
      .catch((e: Error) => setLoadError(e.message || "Failed to load document."))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load preferences for context injection into AI prompts
  useEffect(() => {
    listPreferences("lawyer", { authMode: "creator" })
      .then((prefs) => {
        setCreatorPreferences(Object.fromEntries(prefs.map((p) => [p.key, p.value])));
      })
      .catch(() => {
        setCreatorPreferences(null);
      });
  }, []);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (typeof chatEndRef.current?.scrollIntoView === "function") {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const submitLawyerPatchInstruction = useCallback(async (instruction: string) => {
    if (!instruction.trim() || !id || busy) return;
    if (aiNotice) return;
    if (!acquireActionLock("lawyer-patch")) return;

    const currentDraft = reviewDraft.trim() || buildStarterDraft(doc?.title ?? "Legal draft");

    addMessage("user", instruction);
    addMessage("assistant", "Preparing proposed edits...");
    setBusy(true);

    try {
      const aiResponse = await requestLawyerDocumentEditPlan(id, instruction.trim(), currentDraft);
      const parsed = parseAiEditResponse(aiResponse);
      const applied = applyDocumentPatches(currentDraft, parsed.operations);
      const warnings = [
        ...new Set([
          ...(parsed.warnings ?? []),
          ...parsed.rejectedOperations.map((item) => item.reason),
          ...applied.rejectedOperations.map((item) => item.reason),
        ]),
      ];

      const nextDraft = applied.after;
      setReviewDraft(nextDraft);
      const updatedKnowledge = createManualKnowledge(doc?.title ?? "Legal draft", nextDraft);
      const savedKnowledge = await updateExtractedKnowledge(id, updatedKnowledge, { authMode: "creator" });
      const refreshed = await getDocument(id, { authMode: "creator" });
      setDoc(refreshed);

      const summary = parsed.operations.length > 0
        ? `Applied ${parsed.operations.length} edit${parsed.operations.length !== 1 ? "s" : ""}.`
        : "No edits applied — draft unchanged.";
      addMessage("assistant", warnings.length > 0 ? `${summary} Notes: ${warnings.join("; ")}` : summary, { action: "generate" });

      if (savedKnowledge) {
        const history = await getVersionHistory(id, { authMode: "creator" });
        setVersions(history);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not apply the suggested edits.";
      if (/GEMINI_API_KEY|Gemini is not configured|AI generation is not configured/i.test(msg)) {
        setAiNotice("AI actions are disabled because Gemini is not configured in this environment. You can still edit, save, preview, print, and download.");
        addMessage("assistant", "AI is not available. You can keep editing manually.");
      } else {
        addMessage("assistant", msg);
      }
    } finally {
      setBusy(false);
      releaseActionLock("lawyer-patch");
    }
  }, [aiNotice, busy, doc?.title, id, reviewDraft]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await submitLawyerPatchInstruction(text);
  }, [input, submitLawyerPatchInstruction]);

  const handleTemplatePick = useCallback((template: SmartPageTemplateDefinition) => {
    if (busy) return;
    const draft = buildLawyerTemplateStarterDraft(template, doc?.title);
    setReviewDraft(draft);
    setStage("empty");
    addMessage("system", `Applied template "${template.name}". Edit the draft on the left.`);
  }, [busy, doc?.title]);

  async function handleSaveDraft() {
    if (!id || reviewSaving) return;
    if (!acquireActionLock("save")) return;
    setReviewSaving(true);
    try {
      const knowledge = createManualKnowledge(doc?.title ?? "Legal draft", reviewDraft);
      await updateExtractedKnowledge(id, knowledge, { authMode: "creator" });
      addMessage("system", "Draft saved.");
    } catch (e) {
      addMessage("assistant", e instanceof Error ? e.message : "Could not save the draft.");
    } finally {
      setReviewSaving(false);
      releaseActionLock("save");
    }
  }

  async function handleGenerateDraft() {
    if (!id) return;
    if (!acquireActionLock("generate")) return;
    const draft = reviewDraft.trim() || buildStarterDraft(doc?.title ?? "Legal draft");
    addMessage("assistant", "Preparing your legal draft...");
    setBusy(true);
    setStage("generating");
    try {
      const result = await createManualDocumentVersion(id, { draft, title: doc?.title ?? "Legal draft" }, { authMode: "creator" });
      const refreshed = await getDocument(id, { authMode: "creator" });
      setDoc(refreshed);
      setSchema(result.schema);
      setComponentTree(result.componentTree);
      setActiveVersionId(result.versionId);
      setRenderSettings(refreshed.activeVersion?.renderSettings);
      setStage("ready");
      const history = await getVersionHistory(id, { authMode: "creator" });
      setVersions(history);
      setReviewDraft(refreshed.extractedKnowledge?.rawText || draft);
      addMessage("assistant", "Created a real editable legal draft. You can keep editing, previewing, printing, or downloading it.", { action: "generate" });
    } catch (e) {
      setStage(hasActiveVersion ? "ready" : "empty");
      addMessage("assistant", e instanceof Error ? e.message : "Could not generate the draft.");
    } finally {
      setBusy(false);
      releaseActionLock("generate");
    }
  }

  async function handlePublish(password?: string) {
    if (!id || publishing) return;
    if (!hasActiveVersion) {
      addMessage("assistant", "Create a draft first before publishing.");
      return;
    }
    if (!acquireActionLock("publish")) return;
    setPublishing(true);
    setShowPublishModal(false);
    try {
      const result = await publishDocument(id, password ? { password } : {}, { authMode: "creator" });
      setPublishResult(result);
      const refreshed = await getDocument(id, { authMode: "creator" });
      setDoc(refreshed);
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
      addMessage("assistant", "Create a draft first before printing.");
      return;
    }
    if (!acquireActionLock("print")) return;
    setPrinting(true);
    try {
      await openPrintWindow(id, { authMode: "creator" });
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
      addMessage("assistant", "Create a draft first before downloading.");
      return;
    }
    if (!acquireActionLock(`export-${format}`)) return;
    setExportingFormat(format);
    try {
      await downloadDocumentExport(id, format, { authMode: "creator" });
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
      await restoreVersion(id, v.id, { authMode: "creator" });
      const refreshed = await getDocument(id, { authMode: "creator" });
      if (refreshed.activeVersion) {
        setSchema(refreshed.activeVersion.schema);
        setComponentTree(refreshed.activeVersion.componentTree);
        setActiveVersionId(refreshed.activeVersion.id);
        setRenderSettings(refreshed.activeVersion.renderSettings);
      }
      const history = await getVersionHistory(id, { authMode: "creator" });
      setVersions(history);
      addMessage("assistant", `Restored to: "${v.instruction ?? "initial version"}".`, { action: "restore", versionId: v.id });
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
        <button type="button" className="btn btn-primary mt-4" onClick={() => void navigate("/lawyers/dashboard")}>
          Back to Documents
        </button>
      </div>
    );
  }

  const currentSchema = schema ?? { theme: DEFAULT_THEME, components: [] };
  const stageLabel = stage === "ready" ? "Ready" : stage === "generating" ? "Generating" : "Draft";

  return (
    <div data-testid="lawyer-document-workspace" className="relative flex h-[calc(100vh-4rem)] flex-col overflow-hidden overflow-x-hidden bg-slate-100">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-10 items-center gap-2 px-3 py-2 md:px-4">
          <button
            type="button"
            onClick={() => void navigate("/lawyers/dashboard")}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Back to documents"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{doc.title}</h1>
          {stage === "ready" && hasActiveVersion ? (
            <span className="hidden rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 sm:inline-flex">
              {componentTree.length} components
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto px-3 pb-3 md:overflow-visible">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{stageLabel}</span>
          {aiNotice ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">AI unavailable</span>
          ) : null}
          {publishResult ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">Published secure link ready</span>
          ) : null}
        </div>
      </div>

      {/* Legal disclaimer */}
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900">
        Generated documents are drafts and must be reviewed by a qualified legal professional before use.
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="grid min-h-full gap-0 px-0 py-3 sm:gap-3 sm:px-3 md:p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main editing area */}
          <main className="min-w-0 space-y-4 px-0 sm:px-0">
            {/* Action bar */}
            <div className="flex snap-x snap-mandatory flex-nowrap items-center gap-2 overflow-x-auto border-y border-slate-200 bg-white px-3 py-2 shadow-none ring-0 sm:flex-wrap sm:overflow-visible sm:rounded-2xl sm:border sm:ring-1 sm:ring-slate-100">
              <button
                type="button"
                onClick={() => void handleSaveDraft()}
                className="btn btn-secondary shrink-0 rounded-full text-xs"
                disabled={reviewSaving}
              >
                {reviewSaving ? "Saving..." : "Save draft"}
              </button>
              <button
                type="button"
                onClick={() => void handlePrint()}
                disabled={printing || !hasActiveVersion}
                className="btn btn-secondary shrink-0 rounded-full text-xs disabled:cursor-not-allowed disabled:opacity-50"
                title={!hasActiveVersion ? "Create a draft first before printing." : undefined}
              >
                {printing ? "Opening..." : "Print"}
              </button>
              <button
                type="button"
                onClick={() => { void getVersionHistory(id!, { authMode: "creator" }).then(setVersions); setShowVersions(true); }}
                className="btn btn-secondary shrink-0 rounded-full text-xs"
                disabled={versions.length === 0 && !hasActiveVersion}
              >
                Version history
              </button>
              <button
                type="button"
                onClick={() => setShowPublishModal(true)}
                disabled={publishing || !hasActiveVersion}
                className="btn btn-primary shrink-0 rounded-full text-xs disabled:cursor-not-allowed disabled:opacity-50"
                title={!hasActiveVersion ? "Create a draft first before publishing." : undefined}
              >
                {publishing ? "Publishing..." : publishResult ? "Re-publish Secure Link" : "Publish Secure Link"}
              </button>
            </div>

            {/* Manual draft editor */}
            <section className="w-full bg-transparent px-0 py-2 md:rounded-[28px] md:border md:border-slate-200 md:bg-white md:p-4 md:shadow-sm lg:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--sc-primary)]">Legal Draft Workspace</p>
                  <h2 className="text-lg font-black text-slate-950">{doc.title || "Legal draft workspace"}</h2>
                  <p className="text-sm text-slate-500">Edit your legal document draft here.</p>
                  {aiNotice ? (
                    <p className="text-sm text-slate-600">AI actions are disabled because Gemini is not configured in this environment. You can still edit, save, preview, print, and download.</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => void handleSaveDraft()} disabled={reviewSaving} className="btn btn-secondary shrink-0 text-xs">
                    {reviewSaving ? "Saving..." : "Save draft"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleGenerateDraft()}
                    disabled={busy || stage === "generating"}
                    className="btn btn-primary shrink-0 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {stage === "generating" ? "Generating..." : hasActiveVersion ? "Update draft" : "Create draft"}
                  </button>
                </div>
              </div>
              <textarea
                className="mt-3 min-h-[58vh] w-full resize-none rounded-none border-0 border-y border-slate-200 bg-slate-50 px-0 py-3 text-sm leading-7 text-slate-800 outline-none focus:bg-white md:min-h-[22rem] md:resize-y md:rounded-[24px] md:border md:p-4 md:focus:border-[color:var(--sc-primary)]"
                value={reviewDraft}
                onChange={(e) => setReviewDraft(e.target.value)}
                aria-label="Manual document draft"
              />
            </section>

            {/* Preview section — shown when a version exists */}
            {stage === "ready" && hasActiveVersion ? (
              <section className="bg-transparent px-0 py-2 md:rounded-[28px] md:border md:border-slate-200 md:bg-white md:p-4 md:shadow-sm lg:p-6">
                {publishResult ? (
                  <div className="mb-3 rounded-none border-y border-emerald-200 bg-emerald-50 px-0 py-3 md:rounded-2xl md:border md:px-4">
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
            ) : null}

            {/* Template picker — shown when no active version */}
            {stage === "empty" && lawyerTemplates.length > 0 ? (
              <section className="bg-transparent px-0 py-2 md:rounded-[28px] md:border md:border-slate-200 md:bg-white md:p-4 md:shadow-sm lg:p-6">
                <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--sc-primary)]">Legal templates</p>
                <h2 className="mt-1 text-sm font-black text-slate-950">Start from a template</h2>
                <p className="mt-1 text-sm text-slate-500">Pick a structure and edit the starter draft above.</p>
                <div className="mt-3">
                  <LawyerTemplatePicker
                    templates={lawyerTemplates}
                    onPick={handleTemplatePick}
                    disabled={busy}
                  />
                </div>
              </section>
            ) : null}
          </main>

          {/* Sidebar */}
          <aside className="min-w-0 space-y-4 border-t border-slate-200 px-0 pt-4 lg:sticky lg:top-4 lg:self-start lg:border-0 lg:pt-0">
            <section className="bg-transparent px-0 py-2 md:rounded-[28px] md:border md:border-slate-200 md:bg-white md:p-4 md:shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--sc-primary)]">Legal assistant</p>
                  <h2 className="mt-1 text-sm font-black text-slate-950">Legal guidance</h2>
                </div>
              </div>
              {aiNotice ? (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  AI actions are disabled because Gemini is not configured in this environment. You can still edit, save, preview, print, and download.
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                  Use the draft editor to write or paste your legal content, then ask AI to tighten, restructure, or expand specific sections.
                </div>
              )}
            </section>

            <section className="bg-transparent px-0 py-2 md:rounded-[28px] md:border md:border-slate-200 md:bg-white md:p-4 md:shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-black text-slate-950">Assistant messages</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{messages.length}</span>
              </div>
              <div className="mt-3 max-h-[24rem] space-y-3 overflow-y-auto pr-1">
                {messages.length > 0 ? (
                  messages.map((msg) => <ChatBubble key={msg.id} msg={msg} />)
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                    Messages from AI and system events will appear here.
                  </p>
                )}
                {busy ? (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
                      <span className="inline-flex gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                      </span>
                    </div>
                  </div>
                ) : null}
                <div ref={chatEndRef} />
              </div>
            </section>

            <section className="bg-transparent px-0 py-2 md:rounded-[28px] md:border md:border-slate-200 md:bg-white md:p-4 md:shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-black text-slate-950">Legal actions</h3>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setShowActions((v) => !v)}
                  title={aiNotice ?? undefined}
                >
                  {showActions ? "Hide" : "Show"} actions
                </button>
              </div>
              {showActions ? (
                <>
                  <div className="mt-3 flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
                    <button
                      type="button"
                      onClick={() => void handleDownloadExport("pdf")}
                      disabled={exportingFormat === "pdf" || !hasActiveVersion}
                      className="btn btn-secondary shrink-0 rounded-full text-xs disabled:cursor-not-allowed disabled:opacity-50"
                      title={!hasActiveVersion ? "Create a draft first." : undefined}
                    >
                      {exportingFormat === "pdf" ? "Downloading..." : "Download PDF"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownloadExport("docx")}
                      disabled={exportingFormat === "docx" || !hasActiveVersion}
                      className="btn btn-secondary shrink-0 rounded-full text-xs disabled:cursor-not-allowed disabled:opacity-50"
                      title={!hasActiveVersion ? "Create a draft first." : undefined}
                    >
                      {exportingFormat === "docx" ? "Downloading..." : "Download DOCX"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownloadExport("markdown")}
                      disabled={exportingFormat === "markdown" || !hasActiveVersion}
                      className="btn btn-secondary shrink-0 rounded-full text-xs disabled:cursor-not-allowed disabled:opacity-50"
                      title={!hasActiveVersion ? "Create a draft first." : undefined}
                    >
                      {exportingFormat === "markdown" ? "Downloading..." : "Export Markdown"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPublishModal(true)}
                      disabled={publishing || !hasActiveVersion}
                      className="btn btn-primary shrink-0 rounded-full text-xs disabled:cursor-not-allowed disabled:opacity-50"
                      title={!hasActiveVersion ? "Create a draft first." : undefined}
                    >
                      {publishing ? "Publishing..." : publishResult ? "Re-publish Secure Link" : "Publish Secure Link"}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SuggestionChips
                      items={suggestions}
                      disabled={aiActionsDisabled}
                      onSelect={(s) => {
                        if (aiActionsDisabled) {
                          addMessage("assistant", "AI actions are disabled in this environment. You can still edit the draft manually.");
                          return;
                        }
                        void submitLawyerPatchInstruction(s);
                      }}
                    />
                  </div>
                  <div className="mt-2 flex items-end gap-2">
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
                            ? "Describe what you'd like to draft or ask AI to fill a section."
                            : "Edit: make it more formal, add parties, tighten the deadline..."
                      }
                      className="flex-1 resize-none rounded-none border-0 border-y border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:bg-white disabled:cursor-not-allowed disabled:opacity-50 md:rounded-xl md:border md:focus:border-[color:var(--sc-primary)]"
                      disabled={busy || aiActionsDisabled}
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded-full bg-[color:var(--sc-primary)] p-2.5 text-white hover:bg-[color:var(--sc-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={busy || !input.trim() || aiActionsDisabled}
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
                  Open actions to use AI to patch, restructure, or expand the draft. Manual editing stays available on the left.
                </p>
              )}
            </section>

            {/* Preferences context (read-only display) */}
            {creatorPreferences && Object.keys(creatorPreferences).some((k) => k.startsWith("lawyer.")) ? (
              <section className="bg-transparent px-0 py-2 md:rounded-[28px] md:border md:border-slate-200 md:bg-white md:p-4 md:shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--sc-primary)]">Your profile</p>
                <p className="mt-1 text-sm text-slate-500">AI actions include your saved lawyer profile for context.</p>
              </section>
            ) : null}
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl sm:max-w-sm sm:rounded-2xl sm:p-5">
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
