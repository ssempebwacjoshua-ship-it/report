import { describe, expect, it } from "vitest";
import { scanMigrationSql } from "../../server/utils/migrationSafetyScanner";

describe("migrationSafetyScanner", () => {
  it("catches destructive migration SQL", () => {
    const findings = scanMigrationSql(`
      ALTER TABLE "Student" DROP COLUMN "guardianPhone";
      DROP TABLE "OldImport";
      TRUNCATE TABLE "AuditLog";
    `);

    expect(findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(["DROP_COLUMN", "DROP_TABLE", "TRUNCATE"]),
    );
  });

  it("catches required column additions without default", () => {
    const findings = scanMigrationSql('ALTER TABLE "Student" ADD COLUMN "tenantId" TEXT NOT NULL;');
    expect(findings.some((finding) => finding.code === "UNSAFE_REQUIRED_COLUMN")).toBe(true);
  });

  it("allows nullable expand-contract additions", () => {
    const findings = scanMigrationSql('ALTER TABLE "Student" ADD COLUMN "newExternalId" TEXT;');
    expect(findings).toEqual([]);
  });
});
