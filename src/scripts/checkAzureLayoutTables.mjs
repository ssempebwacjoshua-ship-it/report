import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: node scripts/checkAzureLayoutTables.mjs <path_to_scan.jpg>");
  process.exit(1);
}

const endpoint =
  process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT ||
  process.env.DOCUMENTINTELLIGENCE_ENDPOINT;

const key =
  process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY ||
  process.env.DOCUMENTINTELLIGENCE_API_KEY;

const apiVersion =
  process.env.AZURE_DOCUMENT_INTELLIGENCE_API_VERSION || "2024-11-30";

if (!endpoint || !key) {
  console.error("Missing Azure Document Intelligence endpoint/key env values.");
  process.exit(1);
}

const cleanEndpoint = endpoint.replace(/\/$/, "");
const analyzeUrl =
  `${cleanEndpoint}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=${apiVersion}`;

console.log(`Analyzing: ${path.basename(filePath)}`);
console.log(`API version: ${apiVersion}`);

const fileBuffer = fs.readFileSync(filePath);

const startRes = await fetch(analyzeUrl, {
  method: "POST",
  headers: {
    "Ocp-Apim-Subscription-Key": key,
    "Content-Type": "application/octet-stream",
  },
  body: fileBuffer,
});

if (!startRes.ok) {
  const text = await startRes.text();
  console.error("Analyze request failed:", startRes.status, text);
  process.exit(1);
}

const operationLocation = startRes.headers.get("operation-location");

if (!operationLocation) {
  console.error("Missing operation-location header.");
  process.exit(1);
}

let result;

for (let i = 0; i < 30; i++) {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const pollRes = await fetch(operationLocation, {
    headers: {
      "Ocp-Apim-Subscription-Key": key,
    },
  });

  result = await pollRes.json();

  if (result.status === "succeeded") break;

  if (result.status === "failed") {
    console.error("Analysis failed:", JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log(`Waiting... ${result.status}`);
}

if (result.status !== "succeeded") {
  console.error("Timed out waiting for analysis.");
  process.exit(1);
}

const analyzeResult = result.analyzeResult;

console.log("\n--- Detected Text Lines ---");

for (const page of analyzeResult.pages || []) {
  for (const line of page.lines || []) {
    console.log(`- ${line.content}`);
  }
}

const tables = analyzeResult.tables || [];

if (tables.length === 0) {
  console.log("\nNo structural tables found.");
  console.log("This means Azure returned OCR lines but no table grid.");
  console.log("Next step: use geometry clustering or document-type template fallback.");
  process.exit(0);
}

for (let tIdx = 0; tIdx < tables.length; tIdx++) {
  const table = tables[tIdx];

  console.log(`\n--- Table #${tIdx + 1} ---`);
  console.log(`Dimensions: ${table.rowCount} rows x ${table.columnCount} columns`);

  const grid = Array.from({ length: table.rowCount }, () =>
    Array(table.columnCount).fill("")
  );

  for (const cell of table.cells || []) {
    grid[cell.rowIndex][cell.columnIndex] = (cell.content || "")
      .replace(/\n/g, " ")
      .trim();
  }

  for (const row of grid) {
    console.log(row.map((cell) => cell.padEnd(25)).join(" | "));
  }
}