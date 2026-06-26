import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const serverRoot = path.join(repoRoot, "src", "server");

function readRecursiveFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...readRecursiveFiles(fullPath));
      continue;
    }
    if (entry.isFile() && /\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("audit safety", () => {
  it("keeps application audit writes append-only", () => {
    const files = readRecursiveFiles(serverRoot);
    const forbiddenPatterns = [
      "auditLog.update(",
      "auditLog.delete(",
      "auditLog.deleteMany(",
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      for (const pattern of forbiddenPatterns) {
        expect(content, `${path.relative(repoRoot, file)} should not contain ${pattern}`).not.toContain(pattern);
      }
    }
  });

  it("does not expose audit cleanup routes in production code", () => {
    const files = readRecursiveFiles(serverRoot);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      expect(content, `${path.relative(repoRoot, file)} should not expose audit cleanup`).not.toContain("/api/audit/cleanup");
    }
  });

  it("starts production with prisma migrate deploy and no implicit reset or seed", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["start:prod"]).toContain("prisma migrate deploy");
    expect(packageJson.scripts["start:prod"]).not.toContain("prisma migrate dev");
    expect(packageJson.scripts["start:prod"]).not.toMatch(/\breset\b/i);
    expect(packageJson.scripts["start:prod"]).not.toMatch(/\bseed\b/i);
    expect(packageJson.scripts["railway:start"]).toBe("npm run start:prod");
  });

  it("keeps the Prisma schema indexes for high-risk production tables", () => {
    const schema = fs.readFileSync(path.join(repoRoot, "prisma", "schema.prisma"), "utf8");
    const expectedIndexes = [
      "@@index([schoolId, admissionNumber, isActive]",
      "@@index([schoolId, classId, code]",
      "@@index([schoolId, studentId, subjectId, termId, assessmentType]",
      "@@index([schoolId, studentId, academicYear, term, assessmentType, status]",
      "@@index([schoolId, createdAt]",
      "@@index([documentId, status, createdAt]",
      "@@index([schoolId, physicalUid]",
      "@@index([schoolId, publicCode, createdAt]",
    ];

    for (const expectedIndex of expectedIndexes) {
      expect(schema).toContain(expectedIndex);
    }
  });

  it("includes a non-destructive Phase 6 migration file for the new indexes", () => {
    const migrationPath = path.join(
      repoRoot,
      "prisma",
      "migrations",
      "20260626000000_phase6_audit_and_indexes",
      "migration.sql",
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, "utf8");
    expect(sql).toContain("CREATE INDEX");
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });
});
