import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as Record<string, unknown>;
}

describe("Vercel redirects", () => {
  it("preserves /report-lab/login when www redirects to apex", () => {
    const rootConfig = readJson("vercel.json");
    const redirects = rootConfig.redirects as Array<Record<string, unknown>>;
    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/:path*",
          destination: "https://ssamenj.online/:path*",
          permanent: true,
        }),
      ]),
    );
  });

  it("redirects the public-site www host to apex with path preservation", () => {
    const publicSiteConfig = readJson(path.join("apps", "public-site", "vercel.json"));
    const redirects = publicSiteConfig.redirects as Array<Record<string, unknown>>;
    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/:path*",
          destination: "https://ssamenj.online/:path*",
          permanent: true,
        }),
      ]),
    );
  });

  it("rewrites /report-lab routes without redirecting rewritten system paths back onto themselves", () => {
    const rootRedirects = (readJson("vercel.json").redirects ?? []) as Array<Record<string, unknown>>;
    const publicRedirects = (readJson(path.join("apps", "public-site", "vercel.json")).redirects ?? []) as Array<Record<string, unknown>>;
    const rootRewrites = (readJson("vercel.json").rewrites ?? []) as Array<Record<string, unknown>>;
    const publicRewrites = (readJson(path.join("apps", "public-site", "vercel.json")).rewrites ?? []) as Array<Record<string, unknown>>;

    expect(rootRewrites).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "/report-lab/:path*", destination: "/:path*" }),
    ]));
    expect(publicRewrites).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "/report-lab/:path*", destination: "https://report-sigma-one.vercel.app/:path*" }),
    ]));

    for (const redirects of [rootRedirects, publicRedirects]) {
      expect(redirects).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ source: "/login" }),
        expect.objectContaining({ source: "/logout" }),
        expect.objectContaining({ source: "/forgot-password" }),
        expect.objectContaining({ source: "/reset-password" }),
        expect.objectContaining({ source: "/pwa-launch" }),
        expect.objectContaining({ source: "/dashboard" }),
        expect.objectContaining({ source: "/admin" }),
        expect.objectContaining({ source: "/gate" }),
        expect.objectContaining({ source: "/gate-security" }),
        expect.objectContaining({ source: "/canteen" }),
        expect.objectContaining({ source: "/canteen-charge" }),
      ]));
    }
  });
});
