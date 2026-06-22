/**
 * Generates PWA icons and apple-touch-icon from the SSAMENJ logo.
 * Run once: node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const logoPath = join(root, "apps/public-site/public/ssamenj-logo.png");
const iconsDir = join(root, "public/icons");

const BRAND_BLUE = { r: 11, g: 47, b: 107, alpha: 1 };
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

/** Regular icon — white background, logo centred with padding */
async function makeRegularIcon(size, paddingRatio, outputPath) {
  const pad = Math.round(size * paddingRatio);
  const inner = size - pad * 2;

  const logoBuffer = await sharp(logoPath)
    .resize(inner, inner, { fit: "contain", background: WHITE })
    .flatten({ background: WHITE })
    .png()
    .toBuffer();

  await sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: logoBuffer, top: pad, left: pad }])
    .png()
    .toFile(outputPath);

  console.log("✓", outputPath.replace(root, ""));
}

/** Maskable icon — brand-blue background, logo in central safe zone (80 %) */
async function makeMaskableIcon(size, safeRatio, outputPath) {
  const inner = Math.round(size * safeRatio);
  const pad = Math.round((size - inner) / 2);

  const logoBuffer = await sharp(logoPath)
    .resize(inner, inner, { fit: "contain", background: WHITE })
    .flatten({ background: WHITE })
    .png()
    .toBuffer();

  await sharp({ create: { width: size, height: size, channels: 4, background: BRAND_BLUE } })
    .composite([{ input: logoBuffer, top: pad, left: pad }])
    .png()
    .toFile(outputPath);

  console.log("✓", outputPath.replace(root, ""));
}

await makeRegularIcon(192, 0.08, join(iconsDir, "icon-192.png"));
await makeRegularIcon(512, 0.08, join(iconsDir, "icon-512.png"));
await makeMaskableIcon(192, 0.60, join(iconsDir, "icon-maskable-192.png"));
await makeMaskableIcon(512, 0.60, join(iconsDir, "icon-maskable-512.png"));
await makeRegularIcon(180, 0.10, join(iconsDir, "apple-touch-icon.png"));

console.log("\nAll SSAMENJ icons generated.");
