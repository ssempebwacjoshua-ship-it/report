import { describe, expect, it } from "vitest";
import {
  renderSchemaToDocx,
  renderSchemaToMarkdown,
  renderSchemaToPdf,
} from "../../server/services/documentExportService";
import type { ComponentNode, DocumentSchema } from "../../shared/types/documentIntelligence";

const schema: DocumentSchema = {
  theme: { primaryColor: "#2563eb", fontFamily: "system-ui", pageSize: "A4", orientation: "PORTRAIT" },
  components: [],
};

const components: ComponentNode[] = [
  { id: "h1", type: "header", props: { title: "Joshua Report", subtitle: "P7 Term 1" } },
  { id: "tb1", type: "textBlock", props: { heading: "Summary", content: "Joshua is progressing well." } },
  {
    id: "t1",
    type: "table",
    props: {
      heading: "Scores",
      columns: ["Subject", "Score"],
      rows: [{ Subject: "Math", Score: 88 }],
    },
  },
  { id: "f1", type: "footer", props: { center: "School Connect" } },
];

describe("documentExportService", () => {
  it("renders Markdown from schema components", () => {
    const markdown = renderSchemaToMarkdown("Joshua Report", components);
    expect(markdown).toContain("# Joshua Report");
    expect(markdown).toContain("Joshua is progressing well.");
    expect(markdown).toContain("| Subject | Score |");
  });

  it("renders a PDF buffer from schema components", () => {
    const pdf = renderSchemaToPdf("Joshua Report", schema, components);
    expect(pdf.subarray(0, 8).toString("utf8")).toBe("%PDF-1.4");
    expect(pdf.toString("utf8")).toContain("Joshua Report");
  });

  it("renders a DOCX zip buffer from schema components", () => {
    const docx = renderSchemaToDocx("Joshua Report", components);
    expect(docx.subarray(0, 2).toString("utf8")).toBe("PK");
    expect(docx.toString("utf8")).toContain("word/document.xml");
  });
});
