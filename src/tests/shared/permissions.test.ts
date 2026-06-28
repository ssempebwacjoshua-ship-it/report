import { describe, expect, it } from "vitest";
import { getDefaultRouteForRole } from "../../shared/permissions";

describe("getDefaultRouteForRole", () => {
  it("routes gate security to the gate workspace", () => {
    expect(getDefaultRouteForRole("GATE_SECURITY")).toBe("/nfc/gate");
  });

  it("routes canteen staff to the canteen workspace", () => {
    expect(getDefaultRouteForRole("CANTEEN")).toBe("/nfc/canteen");
  });
});
