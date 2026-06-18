import type { ComponentNode, DocumentSchema } from "../../shared/types/documentIntelligence";

function text(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function xml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function pdfText(value: unknown): string {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]+/g, " ");
}

export function schemaToPlainText(title: string, components: ComponentNode[]): string[] {
  const lines = [title, ""];
  for (const component of components) {
    const props = component.props as Record<string, any>;
    if (component.type === "header") {
      lines.push(text(props.title), text(props.subtitle), text(props.date), "");
    }
    if (component.type === "textBlock" || component.type === "aiSummary") {
      lines.push(text(props.heading), text(props.content), "");
    }
    if (component.type === "profileCard") {
      lines.push(text(props.name), text(props.subtitle));
      for (const field of props.fields ?? []) lines.push(`${text(field.label)}: ${text(field.value)}`);
      lines.push("");
    }
    if (component.type === "statistics") {
      lines.push(text(props.heading || "Statistics"));
      for (const item of props.items ?? []) lines.push(`${text(item.label)}: ${text(item.value)}`);
      lines.push("");
    }
    if (component.type === "table") {
      lines.push(text(props.heading || "Table"));
      const columns = (props.columns ?? []) as string[];
      if (columns.length) lines.push(columns.map(text).join(" | "));
      for (const row of props.rows ?? []) lines.push(columns.map((column) => text(row[column])).join(" | "));
      lines.push("");
    }
    if (component.type === "signature") {
      lines.push(text(props.label || "Signature"), text(props.name), text(props.date), "");
    }
    if (component.type === "footer") {
      lines.push([props.left, props.center, props.right].map(text).filter(Boolean).join(" | "));
    }
  }
  return lines.filter((line) => line !== "");
}

export function renderSchemaToMarkdown(title: string, components: ComponentNode[]): string {
  const lines = [`# ${title}`, ""];
  for (const component of components) {
    const props = component.props as Record<string, any>;
    if (component.type === "header") {
      lines.push(`# ${text(props.title || title)}`);
      if (props.subtitle) lines.push(text(props.subtitle));
      if (props.date) lines.push(text(props.date));
      lines.push("");
    }
    if (component.type === "textBlock" || component.type === "aiSummary") {
      if (props.heading) lines.push(`## ${text(props.heading)}`);
      lines.push(text(props.content), "");
    }
    if (component.type === "profileCard") {
      lines.push(`## ${text(props.name)}`);
      if (props.subtitle) lines.push(text(props.subtitle));
      for (const field of props.fields ?? []) lines.push(`- ${text(field.label)}: ${text(field.value)}`);
      lines.push("");
    }
    if (component.type === "statistics") {
      lines.push(`## ${text(props.heading || "Statistics")}`);
      for (const item of props.items ?? []) lines.push(`- ${text(item.label)}: ${text(item.value)}`);
      lines.push("");
    }
    if (component.type === "table") {
      const columns = (props.columns ?? []) as string[];
      lines.push(`## ${text(props.heading || "Table")}`);
      if (columns.length) {
        lines.push(`| ${columns.map(text).join(" | ")} |`);
        lines.push(`| ${columns.map(() => "---").join(" | ")} |`);
        for (const row of props.rows ?? []) lines.push(`| ${columns.map((column) => text(row[column])).join(" | ")} |`);
      }
      lines.push("");
    }
    if (component.type === "signature") {
      lines.push(`_${text(props.label || "Signature")}_`);
      if (props.name) lines.push(text(props.name));
      if (props.date) lines.push(text(props.date));
      lines.push("");
    }
    if (component.type === "footer") {
      const footer = [props.left, props.center, props.right].map(text).filter(Boolean).join(" | ");
      if (footer) lines.push("---", footer, "");
    }
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function renderSchemaToPdf(title: string, schema: DocumentSchema, components: ComponentNode[]): Buffer {
  const lines = schemaToPlainText(title, components).flatMap((line) => wrapLine(line, 92));
  const pageLines = chunk(lines.length ? lines : [title], schema.theme?.orientation === "LANDSCAPE" ? 36 : 48);
  const objects: string[] = [];
  const fontObjectNumber = 3 + pageLines.length * 2;
  const pageObjectNumbers: number[] = [];

  objects[0] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[1] = "";

  pageLines.forEach((page, index) => {
    const pageObjectNumber = 3 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    pageObjectNumbers.push(pageObjectNumber);
    const width = schema.theme?.orientation === "LANDSCAPE" ? 842 : 595;
    const height = schema.theme?.orientation === "LANDSCAPE" ? 595 : 842;
    const stream = [
      "BT",
      "/F1 11 Tf",
      `50 ${height - 54} Td`,
      "14 TL",
      ...page.map((line) => `(${pdfText(line)}) Tj T*`),
      "ET",
    ].join("\n");
    objects[pageObjectNumber - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`;
    objects[contentObjectNumber - 1] = `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;
  });

  objects[1] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageObjectNumbers.length} >>`;
  objects[fontObjectNumber - 1] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

  const parts = ["%PDF-1.4\n"];
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets[i + 1] = Buffer.byteLength(parts.join(""));
    parts.push(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`);
  }
  const xrefOffset = Buffer.byteLength(parts.join(""));
  parts.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= objects.length; i++) parts.push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  parts.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return Buffer.from(parts.join(""), "utf8");
}

export function renderSchemaToDocx(title: string, components: ComponentNode[]): Buffer {
  const paragraphs = componentsToDocxBody(title, components);
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body>
</w:document>`;
  return createZip([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    },
    { name: "word/document.xml", content: documentXml },
  ]);
}

function componentsToDocxBody(title: string, components: ComponentNode[]): string {
  const out = [docxParagraph(title, true)];
  for (const component of components) {
    const props = component.props as Record<string, any>;
    if (component.type === "header") {
      out.push(docxParagraph(props.title || title, true));
      if (props.subtitle) out.push(docxParagraph(props.subtitle));
      if (props.date) out.push(docxParagraph(props.date));
    }
    if (component.type === "textBlock" || component.type === "aiSummary") {
      if (props.heading) out.push(docxParagraph(props.heading, true));
      out.push(docxParagraph(props.content));
    }
    if (component.type === "profileCard") {
      out.push(docxParagraph(props.name, true));
      if (props.subtitle) out.push(docxParagraph(props.subtitle));
      for (const field of props.fields ?? []) out.push(docxParagraph(`${text(field.label)}: ${text(field.value)}`));
    }
    if (component.type === "statistics") {
      out.push(docxParagraph(props.heading || "Statistics", true));
      for (const item of props.items ?? []) out.push(docxParagraph(`${text(item.label)}: ${text(item.value)}`));
    }
    if (component.type === "table") {
      out.push(docxParagraph(props.heading || "Table", true));
      const columns = (props.columns ?? []) as string[];
      for (const row of props.rows ?? []) out.push(docxParagraph(columns.map((column) => text(row[column])).join(" | ")));
    }
    if (component.type === "signature") out.push(docxParagraph([props.label, props.name, props.date].map(text).filter(Boolean).join(" - ")));
    if (component.type === "footer") out.push(docxParagraph([props.left, props.center, props.right].map(text).filter(Boolean).join(" | ")));
  }
  return out.join("");
}

function docxParagraph(value: unknown, bold = false): string {
  const runProps = bold ? "<w:rPr><w:b/></w:rPr>" : "";
  return `<w:p><w:r>${runProps}<w:t xml:space="preserve">${xml(value)}</w:t></w:r></w:p>`;
}

function wrapLine(line: string, width: number): string[] {
  if (line.length <= width) return [line];
  const words = line.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result.length ? result : [[]];
}

type ZipEntry = { name: string; content: string };

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const content = Buffer.from(entry.content, "utf8");
    const crc = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + content.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

