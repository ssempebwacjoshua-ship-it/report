import "@testing-library/jest-dom/vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PUBLIC_SW_CACHE_PREFIXES,
  PUBLIC_SERVICE_WORKER_SCOPE,
  PUBLIC_SERVICE_WORKER_URL,
  PUBLIC_SW_CLEANUP_MARKER_PARAM,
  PUBLIC_SW_CLEANUP_MARKER_VERSION,
  buildPublicSwCleanupRefreshUrl,
  ownsPublicSiteCache,
  stripPublicSwCleanupMarkerFromLocation,
} from "../../publicSwCleanup";

const appRoot = resolve(__dirname, "../../..");
const sourceRoot = resolve(appRoot, "src");
const swPath = resolve(appRoot, "public/sw.js");
const swSource = readFileSync(swPath, "utf8");
const vercelConfig = JSON.parse(readFileSync(resolve(appRoot, "vercel.json"), "utf8")) as {
  headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
};

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "tests") return [];
      return listSourceFiles(entryPath);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

describe("public service worker recovery release", () => {
  it("keeps the cleanup worker at the root public scope", () => {
    const manifest = JSON.parse(readFileSync(resolve(appRoot, "public/manifest.json"), "utf8"));

    expect(PUBLIC_SERVICE_WORKER_URL).toBe("/sw.js");
    expect(PUBLIC_SERVICE_WORKER_SCOPE).toBe("/");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
  });

  it("no longer registers a public-site service worker from source", () => {
    const source = listSourceFiles(sourceRoot)
      .map((filePath) => readFileSync(filePath, "utf8"))
      .join("\n");

    expect(source).not.toContain("navigator.serviceWorker.register");
    expect(source).not.toContain(".register(\"/sw.js\"");
  });

  it("ships a self-removing cleanup worker at the same public path", () => {
    expect(swSource).toContain("self.addEventListener(\"install\"");
    expect(swSource).toContain("self.skipWaiting()");
    expect(swSource).toContain("self.clients.claim()");
    expect(swSource).toContain("self.registration.unregister()");
    expect(swSource).toContain("client.navigate(refreshUrl)");
  });

  it("serves the cleanup worker and public HTML with revalidation headers without changing asset caching rules", () => {
    expect(vercelConfig.headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/sw.js",
          headers: expect.arrayContaining([{ key: "Cache-Control", value: "no-store, must-revalidate" }]),
        }),
        expect.objectContaining({
          source: "/",
          headers: expect.arrayContaining([{ key: "Cache-Control", value: "no-cache, must-revalidate" }]),
        }),
        expect.objectContaining({
          source: "/:path((?!report-lab/|stayos/|api/stayos/|icons/|images/|.*\\..*).*)",
          headers: expect.arrayContaining([{ key: "Cache-Control", value: "no-cache, must-revalidate" }]),
        }),
      ]),
    );
  });

  it("deletes only public cache prefixes and leaves Gate, Canteen, and system caches untouched", () => {
    expect(PUBLIC_SW_CACHE_PREFIXES).toEqual(["public-site-", "ssamenj-public-site-"]);
    expect(ownsPublicSiteCache("public-site-shell-v1")).toBe(true);
    expect(ownsPublicSiteCache("ssamenj-public-site-assets-v2")).toBe(true);
    expect(ownsPublicSiteCache("report-lab-v6-shell")).toBe(false);
    expect(ownsPublicSiteCache("gate-pwa-v3")).toBe(false);
    expect(ownsPublicSiteCache("canteen-pwa-v4")).toBe(false);
  });

  it("refreshes each public client at most once with a versioned marker", () => {
    const firstRefresh = buildPublicSwCleanupRefreshUrl("https://ssamenj.online/contact#team");
    expect(firstRefresh).toBe(
      `https://ssamenj.online/contact?${PUBLIC_SW_CLEANUP_MARKER_PARAM}=${PUBLIC_SW_CLEANUP_MARKER_VERSION}#team`,
    );

    expect(buildPublicSwCleanupRefreshUrl(firstRefresh!)).toBeNull();
    expect(buildPublicSwCleanupRefreshUrl("https://example.com/")).toBeNull();
  });

  it("strips the one-time cleanup marker after the recovery refresh", () => {
    window.history.replaceState(
      null,
      "",
      `/pricing?${PUBLIC_SW_CLEANUP_MARKER_PARAM}=${PUBLIC_SW_CLEANUP_MARKER_VERSION}&ref=demo#team`,
    );

    expect(stripPublicSwCleanupMarkerFromLocation()).toBe(true);
    expect(window.location.pathname).toBe("/pricing");
    expect(window.location.search).toBe("?ref=demo");
    expect(window.location.hash).toBe("#team");
  });
});
