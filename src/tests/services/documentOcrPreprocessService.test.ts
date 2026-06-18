import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { preprocessDocumentForOcr } from "../../server/services/documentOcrPreprocessService";

describe("preprocessDocumentForOcr", () => {
  it("preserves the original buffer and creates an optimized OCR image", async () => {
    const original = await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: "#f2f2f2",
      },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="1200" height="800"><text x="80" y="150" font-size="72" fill="#111">Handwritten note</text></svg>`,
          ),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();

    const result = await preprocessDocumentForOcr(original, "image/png");
    expect(result.originalBuffer.equals(original)).toBe(true);
    expect(result.processedMimeType).toBe("image/jpeg");
    expect(result.processedBuffer.length).toBeGreaterThan(1000);
    expect(result.width).toBeGreaterThan(0);
    expect(Array.isArray(result.notes)).toBe(true);
  });

  it("falls back to the original for non-image files", async () => {
    const original = Buffer.from("plain text");
    const result = await preprocessDocumentForOcr(original, "text/plain");
    expect(result.processedBuffer.equals(original)).toBe(true);
    expect(result.notes.some((note) => note.code === "ORIGINAL_USED")).toBe(true);
  });
});

