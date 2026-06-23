#!/usr/bin/env node
// Verify that StudentAttendanceEvent.source column exists in the connected DB.
// Usage: node scripts/check-attendance-source.mjs
// Requires DATABASE_URL in env (load via dotenv or railway run).
import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();

const { rows } = await client.query(`
  SELECT column_name, data_type, column_default, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'StudentAttendanceEvent'
    AND column_name = 'source'
`);

await client.end();

if (rows.length === 0) {
  console.error("FAIL: StudentAttendanceEvent.source column is MISSING.");
  console.error("Fix: railway run npx prisma migrate deploy");
  process.exit(1);
}

console.log("OK: StudentAttendanceEvent.source exists.");
console.log(" ", JSON.stringify(rows[0]));
