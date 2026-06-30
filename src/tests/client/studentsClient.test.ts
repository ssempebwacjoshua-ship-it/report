import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);
vi.stubGlobal("crypto", { randomUUID: () => "test-request-id" });

describe("studentsClient school auth", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "test-request-id" });
  });

  it("uploadStudentPassportPhoto sends the school bearer token and ignores creator tokens", async () => {
    const getItem = vi.fn((key: string) => {
      if (key === "sc_auth_token") return "school-token";
      if (key === "sp_creator_token") return "creator-token";
      return null;
    });
    vi.stubGlobal("localStorage", { getItem });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        passportPhotoUrl: "https://res.cloudinary.com/demo/image/upload/v1/school-connect/students/student-1/passport.webp",
        passportPhotoUpdatedAt: "2026-06-27T00:00:00.000Z",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { uploadStudentPassportPhoto } = await import("../../client/studentsClient");

    await uploadStudentPassportPhoto("student-1", new File(["photo"], "passport.jpg", { type: "image/jpeg" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      Authorization: "Bearer school-token",
      "x-request-id": "test-request-id",
    });
    expect(init.headers).not.toHaveProperty("Content-Type");
    expect(getItem).toHaveBeenCalledWith("sc_auth_token");
    expect(getItem).not.toHaveBeenCalledWith("sp_creator_token");
  });

  it("uploadStudentPassportPhoto shows a friendly message when no school token exists", async () => {
    const getItem = vi.fn((key: string) => {
      if (key === "sc_auth_token") return null;
      if (key === "sp_creator_token") return "creator-token";
      return null;
    });
    vi.stubGlobal("localStorage", { getItem });

    const { uploadStudentPassportPhoto } = await import("../../client/studentsClient");

    await expect(
      uploadStudentPassportPhoto("student-1", new File(["photo"], "passport.jpg", { type: "image/jpeg" })),
    ).rejects.toThrow("Please log in again.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploadStudentPassportPhoto surfaces the API error message", async () => {
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => "school-token") });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        error: "Cloudinary cloud name is missing. Set CLOUDINARY_CLOUD_NAME.",
      }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { uploadStudentPassportPhoto } = await import("../../client/studentsClient");

    await expect(
      uploadStudentPassportPhoto("student-1", new File(["photo"], "passport.jpg", { type: "image/jpeg" })),
    ).rejects.toThrow("Cloudinary cloud name is missing. Set CLOUDINARY_CLOUD_NAME.");
  });
});
