import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { checkCropQuality } from "../../server/services/scanPreprocessService";

async function greyJpeg(width: number, height: number, draw: (pixels: Buffer) => void): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height, 255);
  draw(pixels);
  return sharp(pixels, { raw: { width, height, channels: 1 } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

describe("checkCropQuality", () => {
  it("rejects blank crops", async () => {
    const crop = await greyJpeg(48, 48, () => {});
    const quality = await checkCropQuality(crop);

    expect(quality.ok).toBe(false);
    expect(quality.reason).toMatch(/Blank crop/);
  });

  it("rejects border-only crops", async () => {
    const crop = await greyJpeg(48, 48, (pixels) => {
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 3; x++) {
          pixels[y * 48 + x] = 0;
        }
      }
    });
    const quality = await checkCropQuality(crop);

    expect(quality.ok).toBe(false);
    expect(quality.reason).toMatch(/border|vertical/i);
  });

  it("rejects crops dominated by grid lines", async () => {
    const crop = await greyJpeg(48, 48, (pixels) => {
      for (let y = 0; y < 48; y++) {
        for (let x = 22; x <= 24; x++) {
          pixels[y * 48 + x] = 0;
        }
      }
    });
    const quality = await checkCropQuality(crop);

    expect(quality.ok).toBe(false);
    expect(quality.reason).toMatch(/vertical lines/i);
  });
});
