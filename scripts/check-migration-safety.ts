import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { scanMigrationSql } from "../src/server/utils/migrationSafetyScanner";

function changedMigrationFiles(): Set<string> {
  try {
    const tracked = execFileSync("git", ["diff", "--name-only", "--diff-filter=AM", "HEAD", "--", "prisma/migrations"], { encoding: "utf8" });
    const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "prisma/migrations"], { encoding: "utf8" });
    return new Set(
      `${tracked}\n${untracked}`
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.endsWith("migration.sql"))
        .map((line) => path.normalize(line)),
    );
  } catch {
    return new Set();
  }
}

async function allMigrationFiles(): Promise<string[]> {
  const root = path.join(process.cwd(), "prisma", "migrations");
  try {
    const dirs = await fs.readdir(root, { withFileTypes: true });
    return dirs
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(root, entry.name, "migration.sql"));
  } catch {
    return [];
  }
}

async function main() {
  const scanAll = process.argv.includes("--all");
  const failHistorical = process.argv.includes("--fail-historical");
  const changed = changedMigrationFiles();
  const files = await allMigrationFiles();
  let failed = false;
  let findingCount = 0;

  for (const file of files) {
    const rel = path.normalize(path.relative(process.cwd(), file));
    const sql = await fs.readFile(file, "utf8");
    const findings = scanMigrationSql(sql);
    if (findings.length === 0) continue;
    const isChanged = changed.has(rel);
    if (!scanAll && !isChanged) continue;
    findingCount += findings.length;
    if (isChanged || failHistorical) failed = true;
    const label = isChanged ? "new/changed" : "historical";
    console.error(`\n[migration-safety] ${rel} (${label})`);
    for (const finding of findings) {
      console.error(`  ${finding.severity.toUpperCase()} ${finding.code} line ${finding.line}: ${finding.message}`);
      if (finding.snippet) console.error(`    ${finding.snippet}`);
    }
  }

  if (failed) {
    console.error("\n[migration-safety] Failed. Destructive new/changed migration SQL requires an approved expand-contract plan.");
    process.exit(1);
  }

  console.log(`[migration-safety] Passed. ${findingCount} finding(s) reported for scanned migrations; no failing new/changed destructive SQL.`);
}

main().catch((error) => {
  console.error("[migration-safety] Fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});
