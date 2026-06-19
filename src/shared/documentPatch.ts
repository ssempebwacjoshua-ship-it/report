export type DocumentPatch =
  | {
      type: "replace_text";
      oldText: string;
      newText: string;
      reason?: string;
    }
  | {
      type: "insert_after";
      anchorText: string;
      insertText: string;
      reason?: string;
    }
  | {
      type: "append_section";
      heading: string;
      body: string;
      reason?: string;
    }
  | {
      type: "replace_section";
      heading: string;
      newBody: string;
      reason?: string;
    };

export type AiEditResponse = {
  summary: string;
  operations: DocumentPatch[];
  warnings?: string[];
};

export type RejectedPatch = {
  index: number;
  reason: string;
  operation?: unknown;
};

export type AppliedPatchResult = {
  before: string;
  after: string;
  changed: boolean;
  appliedCount: number;
  rejectedCount: number;
  appliedOperations: DocumentPatch[];
  rejectedOperations: RejectedPatch[];
};

type ParsedAiEditResponse = {
  summary: string;
  operations: DocumentPatch[];
  warnings: string[];
  rejectedOperations: RejectedPatch[];
};

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isPatchType(value: unknown): value is DocumentPatch["type"] {
  return value === "replace_text" || value === "insert_after" || value === "append_section" || value === "replace_section";
}

function normalizeReason(value: unknown, fallback: string): string {
  const text = readString(value);
  return text || fallback;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => readString(item)).filter(Boolean) : [];
}

export function parseAiEditResponse(raw: unknown): ParsedAiEditResponse {
  if (!raw || typeof raw !== "object") {
    return {
      summary: "No changes applied.",
      operations: [],
      warnings: [],
      rejectedOperations: [{ index: -1, reason: "AI response was not a JSON object." }],
    };
  }

  const response = raw as Record<string, unknown>;
  const summary = readString(response.summary) || "No changes applied.";
  const warnings = normalizeStringArray(response.warnings);
  const rejectedOperations: RejectedPatch[] = [];
  const operations: DocumentPatch[] = [];

  if (!Array.isArray(response.operations)) {
    rejectedOperations.push({ index: -1, reason: "AI response did not include an operations array." });
    return { summary, operations, warnings, rejectedOperations };
  }

  response.operations.forEach((operation, index) => {
    if (!operation || typeof operation !== "object") {
      rejectedOperations.push({ index, reason: "Operation must be an object.", operation });
      return;
    }

    const patch = operation as Record<string, unknown>;
    if (!isPatchType(patch.type)) {
      rejectedOperations.push({ index, reason: "Unsupported patch type.", operation });
      return;
    }

    if (patch.type === "replace_text") {
      const oldText = readString(patch.oldText);
      const newText = readString(patch.newText);
      if (!oldText) {
        rejectedOperations.push({ index, reason: "replace_text requires oldText.", operation });
        return;
      }
      if (!newText) {
        rejectedOperations.push({ index, reason: "replace_text requires newText.", operation });
        return;
      }
      if (oldText === newText) {
        rejectedOperations.push({ index, reason: "replace_text must change the content.", operation });
        return;
      }
      operations.push({ type: "replace_text", oldText, newText, reason: normalizeReason(patch.reason, "replace text") });
      return;
    }

    if (patch.type === "insert_after") {
      const anchorText = readString(patch.anchorText);
      const insertText = readString(patch.insertText);
      if (!anchorText) {
        rejectedOperations.push({ index, reason: "insert_after requires anchorText.", operation });
        return;
      }
      if (!insertText) {
        rejectedOperations.push({ index, reason: "insert_after requires insertText.", operation });
        return;
      }
      operations.push({ type: "insert_after", anchorText, insertText, reason: normalizeReason(patch.reason, "insert after anchor") });
      return;
    }

    if (patch.type === "append_section") {
      const heading = readString(patch.heading);
      const body = readString(patch.body);
      if (!heading) {
        rejectedOperations.push({ index, reason: "append_section requires heading.", operation });
        return;
      }
      if (!body) {
        rejectedOperations.push({ index, reason: "append_section requires body.", operation });
        return;
      }
      operations.push({ type: "append_section", heading, body, reason: normalizeReason(patch.reason, "append section") });
      return;
    }

    if (patch.type === "replace_section") {
      const heading = readString(patch.heading);
      const newBody = readString(patch.newBody);
      if (!heading) {
        rejectedOperations.push({ index, reason: "replace_section requires heading.", operation });
        return;
      }
      if (!newBody) {
        rejectedOperations.push({ index, reason: "replace_section requires newBody.", operation });
        return;
      }
      operations.push({ type: "replace_section", heading, newBody, reason: normalizeReason(patch.reason, "replace section") });
    }
  });

  return { summary, operations, warnings, rejectedOperations };
}

export function applyDocumentPatches(content: string, patches: DocumentPatch[]): AppliedPatchResult {
  const before = content;
  let current = content;
  const rejectedOperations: RejectedPatch[] = [];
  const appliedOperations: DocumentPatch[] = [];

  for (let index = 0; index < patches.length; index += 1) {
    const patch = patches[index];
    if (patch.type === "replace_text") {
      const position = current.indexOf(patch.oldText);
      if (position < 0) {
        rejectedOperations.push({ index, reason: "oldText was not found in the current document.", operation: patch });
        continue;
      }
      if (patch.oldText === patch.newText) {
        rejectedOperations.push({ index, reason: "Replacement text is identical to the original.", operation: patch });
        continue;
      }
      current = `${current.slice(0, position)}${patch.newText}${current.slice(position + patch.oldText.length)}`;
      appliedOperations.push(patch);
      continue;
    }

    if (patch.type === "insert_after") {
      const position = current.indexOf(patch.anchorText);
      if (position < 0) {
        rejectedOperations.push({ index, reason: "anchorText was not found in the current document.", operation: patch });
        continue;
      }
      const insertAt = position + patch.anchorText.length;
      const separator = needsLeadingSeparator(current.slice(0, insertAt), patch.insertText) ? "\n" : "";
      current = `${current.slice(0, insertAt)}${separator}${patch.insertText}${current.slice(insertAt)}`;
      appliedOperations.push(patch);
      continue;
    }

    if (patch.type === "append_section") {
      const headingLine = formatHeadingLine(patch.heading);
      const body = patch.body.trim();
      const section = `${headingLine}\n${body}`;
      current = current.trimEnd() ? `${current.trimEnd()}\n\n${section}\n` : `${section}\n`;
      appliedOperations.push(patch);
      continue;
    }

    if (patch.type === "replace_section") {
      const range = findSectionRange(current, patch.heading);
      if (!range) {
        rejectedOperations.push({ index, reason: "Section heading was not found in the current document.", operation: patch });
        continue;
      }
      const lines = current.split(/\r?\n/);
      const replacementLines = [lines[range.startLine], ...patch.newBody.trim().split(/\r?\n/)];
      const nextLines = [...lines.slice(0, range.startLine), ...replacementLines, ...lines.slice(range.endLine)];
      current = nextLines.join("\n");
      appliedOperations.push(patch);
    }
  }

  return {
    before,
    after: current,
    changed: current !== before,
    appliedCount: appliedOperations.length,
    rejectedCount: rejectedOperations.length,
    appliedOperations,
    rejectedOperations,
  };
}

function formatHeadingLine(heading: string): string {
  return `${heading.trim().replace(/[:\s]+$/, "")}:`;
}

function needsLeadingSeparator(existingText: string, insertText: string): boolean {
  if (!existingText.trim()) return false;
  if (!insertText.trim()) return false;
  if (/\n\s*$/.test(existingText)) return false;
  if (/^\n/.test(insertText)) return false;
  return true;
}

function normalizeHeading(value: string): string {
  return value
    .trim()
    .replace(/^#{1,6}\s*/, "")
    .replace(/:$/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function findSectionRange(content: string, heading: string): { startLine: number; endLine: number } | null {
  const lines = content.split(/\r?\n/);
  const target = normalizeHeading(heading);
  const startLine = lines.findIndex((line) => normalizeHeading(line) === target);
  if (startLine < 0) return null;

  let endLine = lines.length;
  for (let index = startLine + 1; index < lines.length; index += 1) {
    const normalized = normalizeHeading(lines[index]);
    if (!normalized) continue;
    if (/^#{1,6}\s*/.test(lines[index]) || /:$/.test(lines[index].trim()) || /^[A-Za-z0-9][A-Za-z0-9 /&(),.-]{0,80}:$/.test(lines[index].trim())) {
      endLine = index;
      break;
    }
  }

  return { startLine, endLine };
}
