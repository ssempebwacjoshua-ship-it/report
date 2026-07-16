import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { resolvePublicSiteSystemRedirect } from "../../systemRedirect";

describe("public site system redirect ownership", () => {
  it("maps system-owned short routes into the system app path", () => {
    expect(resolvePublicSiteSystemRedirect("/login")).toBe("/report-lab/login");
    expect(resolvePublicSiteSystemRedirect("/gate")).toBe("/report-lab/nfc/gate");
    expect(resolvePublicSiteSystemRedirect("/canteen")).toBe("/report-lab/nfc/canteen");
    expect(resolvePublicSiteSystemRedirect("/dashboard")).toBe("/report-lab/dashboard");
    expect(resolvePublicSiteSystemRedirect("/account/setup")).toBe("/report-lab/account/setup");
  });

  it("does not send public routes into the system app based only on a local session marker", () => {
    expect(resolvePublicSiteSystemRedirect("/pricing", true)).toBeNull();
  });
});
