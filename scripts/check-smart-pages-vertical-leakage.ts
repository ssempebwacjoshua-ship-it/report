/**
 * Guardrail: verify Smart Pages vertical isolation.
 *
 * School Smart Pages files must not contain lawyer/legal terms.
 * Lawyer Smart Pages files must not contain school-only Report Lab terms.
 *
 * Run: npm run check:smart-pages-verticals
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

// ── Configuration ─────────────────────────────────────────────────────────────

const ROOT = join(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"), "../..");

const SCHOOL_DIRS = [
  "src/pages/smart-pages",
  "src/components/smart-pages",
];

const LAWYER_DIRS = [
  "src/pages/lawyers",
  "src/components/lawyers",
];

// Terms that must NOT appear in school Smart Pages files
const LAWYER_TERMS_IN_SCHOOL = [
  /\blawyer\b/i,
  /\blegal\b/i,
  /\battorney\b/i,
  /\baffidavit\b/i,
  /\bcourt\b/i,
  /\bjurisdiction\b/i,
  /\bLAWYER\.\w+/,                  // LAWYER.* preference keys (not the shared LAWYER_VERTICAL constant)
  /getLawyerPageTemplate/,
  /lawyerTemplate/,
  /submitLawyerPatch/,
  /requestLawyerDocument/,
  /isLawyerWorkspace/,
  /isLawyerKey/,
  /lawyerTemplates/,
  /lawyerStarterDraft/,
];

// Terms that must NOT appear in lawyer-specific files
const SCHOOL_TERMS_IN_LAWYER = [
  /\bmarksheet\b/i,
  /\bstudent\b/i,
  /classStream/,
  /\/smart-pages\//,                // school Smart Pages route paths embedded in lawyer files
  /getSmartPageTemplate(?!s)/,      // getSmartPageTemplateById (not getSmartPageTemplates which is shared)
  /SMART_PAGE_TEMPLATES/,
  /submitInstruction\b/,            // school-only AI pipeline call
  /generateSchema\b/,               // school-only schema generation
];

// Files to skip (shared utilities that legitimately cross verticals)
const SKIP_FILES = new Set([
  "src/shared/smartPagesTemplates.ts",
  "src/shared/lawyerTemplates.ts",
  "src/shared/documentPatch.ts",
]);

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

function findTermViolations(filePath: string, terms: RegExp[]): Array<{ term: string; line: number; text: string }> {
  const content = readFileSync(join(ROOT, filePath), "utf-8");
  const lines = content.split("\n");
  const violations: Array<{ term: string; line: number; text: string }> = [];

  for (const [index, line] of lines.entries()) {
    // Skip comments and import statements — module paths are structural, not domain contamination
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    if (trimmed.startsWith("import ") || trimmed.startsWith("} from ")) continue;

    for (const term of terms) {
      if (term.test(line)) {
        violations.push({ term: term.source, line: index + 1, text: line.trim().slice(0, 120) });
        break;
      }
    }
  }
  return violations;
}

// ── Check ──────────────────────────────────────────────────────────────────────

let totalViolations = 0;

function checkDir(dirs: string[], terms: RegExp[], label: string) {
  const allFiles = dirs.flatMap(collectFiles);
  for (const file of allFiles) {
    if (SKIP_FILES.has(file)) continue;
    const violations = findTermViolations(file, terms);
    if (violations.length > 0) {
      console.error(`\n  ${file} — ${violations.length} violation(s):`);
      for (const v of violations) {
        console.error(`    Line ${v.line}: [${v.term}]  ${v.text}`);
        totalViolations++;
      }
    }
  }
}

console.log("\nChecking Smart Pages vertical isolation...\n");
console.log("School dirs:", SCHOOL_DIRS.join(", "));
checkDir(SCHOOL_DIRS, LAWYER_TERMS_IN_SCHOOL, "school");

console.log("\nLawyer dirs:", LAWYER_DIRS.join(", "));
checkDir(LAWYER_DIRS, SCHOOL_TERMS_IN_LAWYER, "lawyer");

if (totalViolations === 0) {
  console.log("\n  All checks passed. No vertical leakage detected.\n");
  process.exit(0);
} else {
  console.error(`\n  ${totalViolations} violation(s) found. Fix them before merging.\n`);
  process.exit(1);
}
