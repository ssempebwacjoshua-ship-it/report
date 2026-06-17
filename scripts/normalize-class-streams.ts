import "dotenv/config";
import { prisma } from "../src/server/db/prisma";
import { normalizeSchoolClassStreams } from "../src/scripts/repairPreviewClasses";

async function main() {
  const args = process.argv.slice(2);
  const schoolCodes = args.filter((arg) => !arg.startsWith("--"));
  const dryRun = !args.includes("--apply");
  const targets = schoolCodes.length > 0 ? schoolCodes : ["SCU-PREVIEW"];

  try {
    for (const schoolCode of targets) {
      console.log(`\nNormalizing class/stream structure for school: ${schoolCode}`);
      const result = await normalizeSchoolClassStreams(prisma, schoolCode, { dryRun });
      console.log(JSON.stringify({ ...result, dryRun }, null, 2));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

