import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublishedDocumentPage } from "../../pages/smart-pages/PublishedDocumentPage";

const publishedPageMocks = vi.hoisted(() => ({
  getPublishedDocument: vi.fn(),
  downloadPublishedDocumentPdf: vi.fn(),
}));

vi.mock("../../client/documentIntelligenceClient", () => publishedPageMocks);

describe("PublishedDocumentPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows print and download controls for a published Smart Page", async () => {
    publishedPageMocks.getPublishedDocument.mockResolvedValue({
      document: {
        id: "doc-1",
        title: "Published Smart Page",
        status: "PUBLISHED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        versionCount: 1,
        hasSourceFiles: true,
        extractedKnowledge: null,
        activeVersion: {
          id: "version-1",
          instruction: "Publish",
          schema: { theme: { primaryColor: "#2563eb" }, components: [] },
          componentTree: [],
          renderSettings: {},
          createdAt: new Date().toISOString(),
        },
      },
      publishedAt: new Date().toISOString(),
    });

    render(
      <MemoryRouter initialEntries={["/p/demo-token"]}>
        <Routes>
          <Route path="/p/:token" element={<PublishedDocumentPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const downloadButton = await screen.findByLabelText("Download PDF");
    expect(downloadButton).toBeInTheDocument();
    expect(await screen.findByLabelText("Print document")).toBeInTheDocument();
    fireEvent.click(downloadButton);
    await waitFor(() => expect(publishedPageMocks.downloadPublishedDocumentPdf).toHaveBeenCalledWith("demo-token", undefined));
  });
});
