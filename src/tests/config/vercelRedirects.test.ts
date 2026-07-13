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
});
