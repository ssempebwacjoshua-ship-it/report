import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../server/services/authService";

describe("seed admin password contract", () => {
  it("uses the same password hashing logic as login verification", async () => {
    const hash = await hashPassword("password123");
    await expect(verifyPassword("password123", hash)).resolves.toBe(true);
  });
});
