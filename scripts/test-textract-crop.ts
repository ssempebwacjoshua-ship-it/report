/**
 * Direct Amazon Textract crop test.
 *
 * Usage:
 *   npm run test:textract-crop -- .\tmp\ocr-debug\latest\S1A-001-split-1-raw.png
 *
 * Uses synchronous DetectDocumentText on the image bytes (no S3, no async
 * jobs). Prints detected text, confidence, a raw response summary, and a
 * clear error when credentials/region/API fail.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  detectCropText,
  hasTextractCredentials,
  textractRegion,
} from "../src/server/services/textractOcrProvider";

async function main(): Promise<number> {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npm run test:textract-crop -- <path-to-crop-image>");
    return 1;
  }

  const imagePath = resolve(arg);
  console.log(`Image:      ${imagePath}`);
  console.log(`AWS region: ${textractRegion()}`);
  console.log(`Creds:      ${hasTextractCredentials() ? "AWS_ACCESS_KEY_ID set" : "(missing)"}`);

  if (!hasTextractCredentials()) {
    console.error(
      "\nERROR: AWS Textract credentials missing.\n" +
        "Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (and AWS_REGION, default eu-west-1).\n" +
        "The app falls back to manual entry mode in this state.",
    );
    return 1;
  }

  let buffer: Buffer;
  try {
    buffer = readFileSync(imagePath);
  } catch (err) {
    console.error(`\nERROR: cannot read image: ${err instanceof Error ? err.message : err}`);
    return 1;
  }

  const annotation = await detectCropText(buffer);

  if (annotation.error) {
    console.error(`\nERROR from Textract: ${annotation.error}`);
    return 1;
  }

  console.log(`\nText:       ${JSON.stringify(annotation.text)}`);
  console.log(`Confidence: ${(annotation.confidence * 100).toFixed(0)}% (${annotation.confidenceSource})`);
  console.log(`Raw:        ${JSON.stringify(annotation.raw, null, 2)}`);
  return 0;
}

main().then((code) => {
  process.exitCode = code;
});
