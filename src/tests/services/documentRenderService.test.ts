import { describe, expect, it } from "vitest";
import { renderSchemaToHtml } from "../../server/services/documentRenderService";
import type { ComponentNode, DocumentSchema } from "../../shared/types/documentIntelligence";

const schema: DocumentSchema = {
  theme: { primaryColor: "#2563eb", fontFamily: "system-ui", pageSize: "A4", orientation: "PORTRAIT" },
  components: [],
};

const components: ComponentNode[] = [
  { id: "h1", type: "header", props: { title: "Print Test" } },
  {
    id: "t1",
    type: "table",
    props: {
      heading: "Rows",
      columns: ["Name", "Subject"],
      rows: [{ Name: "MAKOHA LAWRENCE", Subject: "Physics" }],
    },
  },
];

describe("renderSchemaToHtml", () => {
  it("includes A4 print and page-break safeguards", () => {
    const html = renderSchemaToHtml(schema, components, "Print Test");
    expect(html).toContain("@page{size:A4 PORTRAIT;margin:14mm}");
    expect(html).toContain("page-break-inside:avoid");
    expect(html).toContain("thead{display:table-header-group}");
    expect(html).toContain("print-color-adjust:exact");
  });

  it("uses compact print margins when fitToOnePage is enabled", () => {
    const html = renderSchemaToHtml(schema, components, "Print Test", { fitToOnePage: true });
    expect(html).toContain("@page{size:A4 PORTRAIT;margin:10mm}");
    expect(html).toContain("compact-block");
  });
});
