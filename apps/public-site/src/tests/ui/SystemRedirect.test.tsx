import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it } from "vitest";
import { resolvePublicSiteSystemRedirect } from "../../systemRedirect";

describe("public site system redirect ownership", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("maps system-owned short routes into the system app path", () => {
    expect(resolvePublicSiteSystemRedirect("/login")).toBe("/report-lab/login");
    expect(resolvePublicSiteSystemRedirect("/gate")).toBe("/report-lab/nfc/gate");
    expect(resolvePublicSiteSystemRedirect("/canteen")).toBe("/report-lab/nfc/canteen");
    expect(resolvePublicSiteSystemRedirect("/dashboard")).toBe("/report-lab/dashboard");
    expect(resolvePublicSiteSystemRedirect("/account/setup")).toBe("/report-lab/account/setup");
  });

  it("sends previously authenticated users from public routes back into the system app launch flow", () => {
    expect(resolvePublicSiteSystemRedirect("/pricing", true)).toBe("/report-lab/pwa-launch");
  });
});
