/**
 * Direct Google Vision crop test.
 *
 * Usage:
 *   npm run test:google-vision-crop -- .\tmp\ocr-debug\latest\S1A-001-split-1-raw.png
 *
 * Prints the recognized text, confidence (and whether it came from the API
 * or a default), a raw response summary, and a clear error when credentials
 * or the API call fail.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  annotateCropBuffer,
  hasGoogleVisionCredentials,
  visionFeature,
} from "../src/server/services/googleVisionOcrProvider";

async function main(): Promise<number> {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npm run test:google-vision-crop -- <path-to-crop-image>");
    return 1;
  }

  const imagePath = resolve(arg);
  console.log(`Image:      ${imagePath}`);
  console.log(`Feature:    ${visionFeature()}`);
  console.log(`Credentials ${process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "(not set)"}`);

  if (!hasGoogleVisionCredentials()) {
    console.error(
      "\nERROR: Google Vision credentials missing.\n" +
        "Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON file path.\n" +
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

  const annotation = await annotateCropBuffer(buffer);

  if (annotation.error) {
    console.error(`\nERROR from Vision API: ${annotation.error}`);
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
