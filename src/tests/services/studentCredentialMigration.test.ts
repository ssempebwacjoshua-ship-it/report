import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("student credential duplicate-active migration", () => {
  it("documents the preflight duplicate check and adds the partial active credential index", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "prisma/migrations/20260621120000_prevent_duplicate_active_student_credentials/migration.sql"),
      "utf8",
    );

    expect(sql).toContain('SELECT "schoolId", "studentId", "type", COUNT(*)');
    expect(sql).toContain('FROM "StudentCredential"');
    expect(sql).toContain('WHERE "status" = \'ACTIVE\'');
    expect(sql).toContain('HAVING COUNT(*) > 1');
    expect(sql).toContain('CREATE UNIQUE INDEX "StudentCredential_one_active_per_student_type_idx"');
    expect(sql).toContain('ON "StudentCredential"("schoolId", "studentId", "type")');
    expect(sql).toContain('WHERE "status" = \'ACTIVE\'');
  });
});
