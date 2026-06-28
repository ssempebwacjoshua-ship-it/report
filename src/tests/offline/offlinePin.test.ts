import { pbkdf2Sync } from "crypto";
import { describe, expect, it } from "vitest";
import { verifyLocalWalletPin } from "../../offline/offlinePin";

function makeStoredPin(pin: string) {
  const salt = "00112233445566778899aabbccddeeff";
  const hash = pbkdf2Sync(pin, salt, 1000, 64, "sha512").toString("hex");
  return `pbkdf2$1000$${salt}$${hash}`;
}

describe("verifyLocalWalletPin", () => {
  it("verifies the server PBKDF2 wallet PIN hash format locally", async () => {
    const stored = makeStoredPin("1234");

    await expect(verifyLocalWalletPin("1234", stored)).resolves.toBe(true);
    await expect(verifyLocalWalletPin("9999", stored)).resolves.toBe(false);
  });
});
