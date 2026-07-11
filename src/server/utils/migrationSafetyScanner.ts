export type MigrationSafetySeverity = "error" | "warning";

export type MigrationSafetyFinding = {
  severity: MigrationSafetySeverity;
  code: string;
  message: string;
  line: number;
  snippet: string;
};

const DANGEROUS_PATTERNS: Array<{ code: string; message: string; pattern: RegExp }> = [
  { code: "DROP_TABLE", message: "DROP TABLE requires owner review, backup confirmation, and an explicit migration plan.", pattern: /\bDROP\s+TABLE\b/i },
  { code: "DROP_COLUMN", message: "DROP COLUMN is destructive and must use an expand-contract migration.", pattern: /\bDROP\s+COLUMN\b/i },
  { code: "TRUNCATE", message: "TRUNCATE destroys data and is not allowed in production migrations.", pattern: /\bTRUNCATE\b/i },
  { code: "ALTER_SET_NOT_NULL", message: "ALTER COLUMN SET NOT NULL can fail or corrupt rollout safety without backfill verification.", pattern: /\bALTER\s+COLUMN\b[\s\S]*?\bSET\s+NOT\s+NULL\b/i },
  { code: "ALTER_COLUMN_TYPE", message: "ALTER COLUMN TYPE can rewrite or lose data and requires explicit review.", pattern: /\bALTER\s+COLUMN\b[\s\S]*?\bTYPE\b/i },
  { code: "ON_DELETE_CASCADE", message: "ON DELETE CASCADE must be justified for tenant and audit safety.", pattern: /\bON\s+DELETE\s+CASCADE\b/i },
];

function statementLine(sql: string, index: number): number {
  return sql.slice(0, index).split(/\r?\n/).length;
}

function lineSnippet(sql: string, line: number): string {
  return sql.split(/\r?\n/)[line - 1]?.trim() ?? "";
}

function splitStatements(sql: string): Array<{ text: string; startIndex: number }> {
  const statements: Array<{ text: string; startIndex: number }> = [];
  let startIndex = 0;
  for (const part of sql.split(";")) {
    const text = part.trim();
    if (text) statements.push({ text, startIndex });
    startIndex += part.length + 1;
  }
  return statements;
}

export function scanMigrationSql(sql: string): MigrationSafetyFinding[] {
  const findings: MigrationSafetyFinding[] = [];

  for (const { code, message, pattern } of DANGEROUS_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(sql);
    if (!match) continue;
    const line = statementLine(sql, match.index);
    findings.push({ severity: "error", code, message, line, snippet: lineSnippet(sql, line) });
  }

  for (const statement of splitStatements(sql)) {
    if (!/\bALTER\s+TABLE\b/i.test(statement.text) || !/\bADD\s+COLUMN\b/i.test(statement.text)) continue;
    if (!/\bNOT\s+NULL\b/i.test(statement.text)) continue;
    if (/\bDEFAULT\b/i.test(statement.text)) continue;
    const line = statementLine(sql, statement.startIndex);
    findings.push({
      severity: "error",
      code: "UNSAFE_REQUIRED_COLUMN",
      message: "Adding a NOT NULL column without a default/backfill path is unsafe. Use expand-contract.",
      line,
      snippet: lineSnippet(sql, line),
    });
  }

  return findings;
}
