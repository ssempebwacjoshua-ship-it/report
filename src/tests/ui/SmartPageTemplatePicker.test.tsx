import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SmartPageTemplatePicker } from "../../components/smart-pages/SmartPageTemplatePicker";
import { getSmartPageTemplates } from "../../shared/smartPagesTemplates";

describe("SmartPageTemplatePicker", () => {
  it("renders parsed document templates with create actions", () => {
    const onPickTemplate = vi.fn();
    render(
      <SmartPageTemplatePicker
        templates={getSmartPageTemplates("parsed").slice(0, 2)}
        scope="parsed"
        onPickTemplate={onPickTemplate}
      />,
    );

    expect(screen.getByText("Clean & Rebuild Document")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clean & rebuild document/i })).toBeInTheDocument();
  });

  it("passes the selected template and summary style to the callback", () => {
    const onPickTemplate = vi.fn();
    render(
      <SmartPageTemplatePicker
        templates={getSmartPageTemplates("parsed").filter((template) => template.id === "summarize-document")}
        scope="parsed"
        onPickTemplate={onPickTemplate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /simple-language summary/i }));
    fireEvent.click(screen.getByRole("button", { name: /summarize document/i }));

    expect(onPickTemplate).toHaveBeenCalledTimes(1);
    expect(onPickTemplate.mock.calls[0][0].id).toBe("summarize-document");
    expect(onPickTemplate.mock.calls[0][1]).toEqual({ summaryStyleId: "simple" });
  });
});
