/**
 * Guardrail: verify Smart Pages vertical isolation across the full codebase.
 *
 * Checks:
 * 1. School Smart Pages files must not contain lawyer/legal terms (except shared registry).
 * 2. Lawyer Smart Pages files must not contain school-only Report Lab terms.
 * 3. Structural checks: schema has vertical field, routes enforce vertical, client passes vertical.
 *
 * Run: npm run check:smart-pages-verticals
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

// ── Configuration ─────────────────────────────────────────────────────────────

const ROOT = join(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"), "../..");

// ── Domain boundary scans ─────────────────────────────────────────────────────

const SCHOOL_CONTENT_DIRS = [
  "src/pages/smart-pages",
  "src/components/smart-pages",
];

const LAWYER_CONTENT_DIRS = [
  "src/pages/lawyers",
  "src/components/lawyers",
];

// These files cross vertical boundaries by design — skip them in content scans.
const SHARED_VERTICAL_REGISTRY_FILES = new Set([
  "src/shared/smartPagesTemplates.ts",
  "src/shared/lawyerTemplates.ts",
  "src/shared/documentPatch.ts",
  "src/shared/verticalPreferences.ts",
]);

// Terms that MUST NOT appear in school Smart Pages files (except shared registry)
const LAWYER_TERMS_IN_SCHOOL: RegExp[] = [
  /\blawyer\b/i,
  /\blegal\b/i,
  /\battorney\b/i,
  /\baffidavit\b/i,
  /\bcourt\b/i,
  /\bjurisdiction\b/i,
  /\bLAWYER\.\w+/,                   // LAWYER.* preference keys
  /getLawyerPageTemplate/,
  /lawyerTemplate[^s]/,               // lawyerTemplate (not lawyerTemplates as type name from shared)
  /submitLawyerPatch/,
  /requestLawyerDocument/,
  /isLawyerWorkspace/,
  /isLawyerKey/,
  /lawyerStarterDraft/,
];

// Terms that MUST NOT appear in lawyer-specific files
const SCHOOL_TERMS_IN_LAWYER: RegExp[] = [
  /\bmarksheet\b/i,
  /classStream/,
  /getSmartPageTemplate[^s]/,          // getSmartPageTemplateById but not getSmartPageTemplates
  /SMART_PAGE_TEMPLATES/,
  /submitInstruction\b/,               // school-only AI pipeline call
  /generateSchema\b/,                  // school-only schema generation
];

// ── Structural checks ────────────────────────────────────────────────────────

interface StructuralCheck {
  description: string;
  file: string;
  pattern: RegExp;
  mustMatch: boolean;  // true = pattern must be found; false = pattern must NOT be found
}

const STRUCTURAL_CHECKS: StructuralCheck[] = [
  {
    description: "SmartDocument model must have a `vertical` field",
    file: "prisma/schema.prisma",
    pattern: /vertical\s+SmartDocumentVertical/,
    mustMatch: true,
  },
  {
    description: "SmartDocumentVertical enum must be defined in schema",
    file: "prisma/schema.prisma",
    pattern: /enum SmartDocumentVertical \{/,
    mustMatch: true,
  },
  {
    description: "listDocuments client must accept vertical option",
    file: "src/client/documentIntelligenceClient.ts",
    pattern: /listDocuments\(options\?.*vertical/,
    mustMatch: true,
  },
  {
    description: "createDocument client must accept vertical + authMode options",
    file: "src/client/documentIntelligenceClient.ts",
    pattern: /createDocument\(title\?.*options\?.*vertical.*authMode/,
    mustMatch: true,
  },
  {
    description: "lawyer-edit-plan route must exist in documentIntelligenceRoutes",
    file: "src/server/routes/documentIntelligenceRoutes.ts",
    pattern: /lawyer-edit-plan/,
    mustMatch: true,
  },
  {
    description: "lawyer-edit-plan route must call getLawyerDocumentEditPlan (vertical guard is inside)",
    file: "src/server/routes/documentIntelligenceRoutes.ts",
    pattern: /getLawyerDocumentEditPlan/,
    mustMatch: true,
  },
  {
    description: "listDocuments service must accept vertical parameter",
    file: "src/server/services/documentIntelligenceService.ts",
    pattern: /listDocuments\(creatorId: string, vertical\?/,
    mustMatch: true,
  },
  {
    description: "createDocument service must accept vertical parameter",
    file: "src/server/services/documentIntelligenceService.ts",
    pattern: /createDocument\(creatorId: string, title: string, vertical:/,
    mustMatch: true,
  },
  {
    description: "getLawyerDocumentEditPlan service must guard non-LAWYER documents via assertDocumentVertical",
    file: "src/server/services/documentIntelligenceService.ts",
    pattern: /assertDocumentVertical\(doc, "LAWYER"/,
    mustMatch: true,
  },
  {
    description: "generateSchema service must guard SCHOOL vertical via assertDocumentVertical",
    file: "src/server/services/documentIntelligenceService.ts",
    pattern: /assertDocumentVertical\(doc, "SCHOOL"/,
    mustMatch: true,
  },
  {
    description: "School SmartPagesPage must pass vertical: SCHOOL and authMode: school to listDocuments",
    file: "src/pages/smart-pages/SmartPagesPage.tsx",
    pattern: /listDocuments\(.*vertical: "SCHOOL".*authMode: "school"/,
    mustMatch: true,
  },
  {
    description: "School SmartPagesPage must pass vertical: SCHOOL and authMode: school to createDocument",
    file: "src/pages/smart-pages/SmartPagesPage.tsx",
    pattern: /createDocument\(.*vertical: "SCHOOL".*authMode: "school"/,
    mustMatch: true,
  },
  {
    description: "LawyerDocumentsPage must pass vertical: LAWYER and authMode: creator to listDocuments",
    file: "src/pages/lawyers/LawyerDocumentsPage.tsx",
    pattern: /listDocuments\(.*vertical: "LAWYER".*authMode: "creator"/,
    mustMatch: true,
  },
  {
    description: "LawyerDocumentsPage must pass vertical: LAWYER and authMode: creator to createDocument",
    file: "src/pages/lawyers/LawyerDocumentsPage.tsx",
    pattern: /createDocument\(.*vertical: "LAWYER".*authMode: "creator"/,
    mustMatch: true,
  },
  {
    description: "PreferencesPage must NOT import LAWYER_VERTICAL directly",
    file: "src/pages/smart-pages/PreferencesPage.tsx",
    pattern: /import.*LAWYER_VERTICAL.*smartPagesTemplates/,
    mustMatch: false,
  },
  {
    description: "requestLawyerDocumentEditPlan client must use lawyerAuthHeaders (not generic authHeaders)",
    file: "src/client/documentIntelligenceClient.ts",
    pattern: /requestLawyerDocumentEditPlan[\s\S]{0,400}lawyerAuthHeaders/,
    mustMatch: true,
  },
  {
    description: "documentIntelligenceRoutes must have parseSmartDocumentVertical (throws 400 on invalid vertical)",
    file: "src/server/routes/documentIntelligenceRoutes.ts",
    pattern: /parseSmartDocumentVertical/,
    mustMatch: true,
  },
  {
    description: "POST /api/smart-documents route must use parsedVertical when calling createDocument",
    file: "src/server/routes/documentIntelligenceRoutes.ts",
    pattern: /parsedVertical/,
    mustMatch: true,
  },
  {
    description: "shared types must export SmartDocumentVertical",
    file: "src/shared/types/documentIntelligence.ts",
    pattern: /export type SmartDocumentVertical/,
    mustMatch: true,
  },
  {
    description: "SmartDocumentSummary must include vertical field typed as SmartDocumentVertical",
    file: "src/shared/types/documentIntelligence.ts",
    pattern: /vertical\s*:\s*SmartDocumentVertical/,
    mustMatch: true,
  },
  {
    description: "documentOsClient must use makeCreatorRequestHeaders for explicit creator auth isolation",
    file: "src/client/documentOsClient.ts",
    pattern: /makeCreatorRequestHeaders/,
    mustMatch: true,
  },
  {
    description: "LawyerDocumentEditorPage must call listPreferences with authMode creator",
    file: "src/pages/lawyers/LawyerDocumentEditorPage.tsx",
    pattern: /listPreferences\("lawyer",\s*\{.*authMode:\s*"creator"/,
    mustMatch: true,
  },
  {
    description: "School PreferencesPage must call listPreferences with authMode school",
    file: "src/pages/smart-pages/PreferencesPage.tsx",
    pattern: /listPreferences\("school",\s*\{.*authMode:\s*"school"/,
    mustMatch: true,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function collectFiles(dir: string): string[] {
  const abs = join(ROOT, dir);
  const files: string[] = [];
  try {
    for (const entry of readdirSync(abs)) {
      const full = join(abs, entry);
      if (statSync(full).isDirectory()) {
        files.push(...collectFiles(join(dir, entry)));
      } else if (/\.(tsx?|js)$/.test(entry)) {
        files.push(join(dir, entry).replace(/\\/g, "/"));
      }
    }
  } catch {
    // directory doesn't exist yet — not an error
  }
  return files;
}

function readFile(relPath: string): string {
  try {
    return readFileSync(join(ROOT, relPath), "utf-8");
  } catch {
    return "";
  }
}

// Module path fragments that are allowed even in cross-vertical import lines.
// Imports from these sources are neutral and do not indicate vertical leakage.
const NEUTRAL_IMPORT_SOURCES = [
  "verticalPreferences",   // isNonSchoolPreferenceKey — the approved school helper
  "documentPatch",         // shared patch operation types
];

// Returns true when a line is an import FROM an explicitly approved neutral module.
// We do NOT globally skip all import lines — only those from approved sources.
// Imports of lawyer-specific symbols must be caught even when inside an import statement.
function isApprovedImportLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("import ") && !trimmed.startsWith("} from ")) return false;
  const fromMatch = /from\s+["']([^"']+)["']/.exec(line);
  if (!fromMatch) return true; // side-effect-only import — no source path to check
  const sourcePath = fromMatch[1];
  return NEUTRAL_IMPORT_SOURCES.some((approved) => sourcePath.includes(approved));
}

function findTermViolations(filePath: string, terms: RegExp[]): Array<{ term: string; line: number; text: string }> {
  const content = readFile(filePath);
  const lines = content.split("\n");
  const violations: Array<{ term: string; line: number; text: string }> = [];

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    // Skip comments.
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    // Skip imports only when they are from approved neutral sources.
    // Imports of lawyer/school symbols from non-approved paths ARE flagged.
    if (isApprovedImportLine(line)) continue;

    for (const term of terms) {
      if (term.test(line)) {
        violations.push({ term: term.source, line: index + 1, text: trimmed.slice(0, 120) });
        break;
      }
    }
  }
  return violations;
}

// ── Run checks ────────────────────────────────────────────────────────────────

let totalViolations = 0;

function fail(message: string) {
  console.error(`  FAIL: ${message}`);
  totalViolations++;
}

// 1. School content dirs — no lawyer terms
console.log("\nChecking school Smart Pages dirs for lawyer leakage...");
for (const dir of SCHOOL_CONTENT_DIRS) {
  for (const file of collectFiles(dir)) {
    if (SHARED_VERTICAL_REGISTRY_FILES.has(file)) continue;
    const violations = findTermViolations(file, LAWYER_TERMS_IN_SCHOOL);
    for (const v of violations) {
      fail(`${file}:${v.line} [${v.term}] — ${v.text}`);
    }
  }
}

// 2. Lawyer content dirs — no school-only terms
console.log("Checking lawyer Smart Pages dirs for school leakage...");
for (const dir of LAWYER_CONTENT_DIRS) {
  for (const file of collectFiles(dir)) {
    if (SHARED_VERTICAL_REGISTRY_FILES.has(file)) continue;
    const violations = findTermViolations(file, SCHOOL_TERMS_IN_LAWYER);
    for (const v of violations) {
      fail(`${file}:${v.line} [${v.term}] — ${v.text}`);
    }
  }
}

// 3. Structural checks
console.log("Running structural checks...");
for (const check of STRUCTURAL_CHECKS) {
  const content = readFile(check.file);
  if (!content) {
    if (check.mustMatch) fail(`${check.description} — file not found: ${check.file}`);
    continue;
  }
  const matched = check.pattern.test(content);
  if (check.mustMatch && !matched) {
    fail(`${check.description} — pattern not found in ${check.file}`);
  } else if (!check.mustMatch && matched) {
    fail(`${check.description} — forbidden pattern found in ${check.file}`);
  }
}

// ── Result ────────────────────────────────────────────────────────────────────

if (totalViolations === 0) {
  console.log("\n  All checks passed. No vertical leakage detected.\n");
  process.exit(0);
} else {
  console.error(`\n  ${totalViolations} violation(s) found. Fix them before merging.\n`);
  process.exit(1);
}
