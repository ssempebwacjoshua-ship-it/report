import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const rows = await prisma.$queryRawUnsafe(`
SELECT column_name, udt_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'StudentAttendanceEvent'
  AND column_name IN ('credentialId', 'source', 'status', 'reason')
ORDER BY column_name;
`);

console.log(rows);

await prisma.$disconnect();
