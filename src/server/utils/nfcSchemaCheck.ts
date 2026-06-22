import type { PrismaClient } from "@prisma/client";

export type NfcSchemaStatus = {
  ok: boolean;
  missing: string[];
};

/**
 * Checks whether the NFC wristband tables and critical columns exist.
 * Uses information_schema queries so it works regardless of Prisma model state.
 * Returns a list of missing objects — empty list means everything is present.
 */
export async function checkNfcWristbandSchema(db: PrismaClient): Promise<NfcSchemaStatus> {
  const missing: string[] = [];

  try {
    const tables = await db.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'StudentCredential',
          'StudentWallet',
          'StudentWalletTransaction',
          'StudentAttendanceEvent',
          'NfcGateScan'
        )
    `;

    const found = new Set(tables.map((r) => r.table_name));
    for (const t of ["StudentCredential", "StudentWallet", "StudentWalletTransaction", "StudentAttendanceEvent", "NfcGateScan"]) {
      if (!found.has(t)) missing.push(`table "${t}"`);
    }

    // Only check the column if the table exists
    if (found.has("StudentCredential")) {
      const cols = await db.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'StudentCredential'
          AND column_name = 'scanToken'
      `;
      if (cols.length === 0) missing.push('column "StudentCredential"."scanToken"');
    }
  } catch {
    missing.push("(could not connect to database to verify schema)");
  }

  return { ok: missing.length === 0, missing };
}

/**
 * Returns true if a Prisma error indicates a missing table or column.
 * P2021 = table does not exist, P2022 = column does not exist.
 */
export function isPrismaSchemaMissingError(error: unknown): { missing: string } | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    (error as { code: unknown }).code === "P2021"
  ) {
    const msg = String((error as { message: unknown }).message);
    const match = msg.match(/table `([^`]+)`/) ?? msg.match(/"([^"]+)"/);
    return { missing: `table ${match ? match[1] : "(unknown)"}` };
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2022"
  ) {
    const msg = String((error as { message: unknown }).message);
    const match = msg.match(/column `([^`]+)`/) ?? msg.match(/"([^"]+)"/);
    return { missing: `column ${match ? match[1] : "(unknown)"}` };
  }
  return null;
}
