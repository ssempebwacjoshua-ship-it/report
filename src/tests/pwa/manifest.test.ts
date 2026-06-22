import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../../..");

describe("PWA manifest", () => {
  const manifestPath = resolve(root, "public/manifest.webmanifest");

  it("exists and is valid JSON", () => {
    expect(existsSync(manifestPath)).toBe(true);
    expect(() => JSON.parse(readFileSync(manifestPath, "utf8"))).not.toThrow();
  });

  it("has the required fields", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(manifest.name).toBe("SSAMENJ Technologies");
    expect(manifest.short_name).toBe("SSAMENJ");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.theme_color).toBeTruthy();
    expect(manifest.background_color).toBeTruthy();
  });

  it("declares 192 and 512 icons including maskable, and the files exist", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
    for (const icon of manifest.icons) {
      expect(existsSync(resolve(root, "public", icon.src.replace(/^\//, "")))).toBe(true);
    }
    expect(existsSync(resolve(root, "public/icons/apple-touch-icon.png"))).toBe(true);
  });
});

describe("index.html PWA wiring", () => {
  const html = readFileSync(resolve(root, "index.html"), "utf8");

  it("links manifest, theme-color, viewport and apple meta", () => {
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('name="theme-color"');
    expect(html).toContain('name="viewport"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('name="apple-mobile-web-app-title"');
  });
});

describe("service worker safety", () => {
  const sw = readFileSync(resolve(root, "public/sw.js"), "utf8");

  it("exists and never intercepts API or cross-origin requests", () => {
    // Bails out for cross-origin and /api/ paths before any caching logic.
    expect(sw).toContain("url.origin !== self.location.origin");
    expect(sw).toContain('url.pathname.startsWith("/api/")');
    expect(sw).toContain('req.method !== "GET"');
  });

  it("uses a versioned cache for safe updates", () => {
    expect(sw).toMatch(/CACHE_VERSION/);
    expect(sw).toContain("skipWaiting");
    expect(sw).toContain("clients.claim");
  });
});

