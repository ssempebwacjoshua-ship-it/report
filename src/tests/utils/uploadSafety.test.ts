import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import { ensureNonEmptyUpload, validateScanUpload, validateStudentImportUpload } from "../../server/utils/uploadSafety";

describe("upload safety helpers", () => {
  it("accepts valid CSV student imports", () => {
    const file = {
      buffer: Buffer.from("admissionNumber,fullName\nS1A-001,Ada Lovelace\n"),
      originalname: "students.csv",
      mimetype: "text/csv",
      size: 47,
    } as const;
    expect(validateStudentImportUpload(file)).toEqual({ kind: "csv" });
  });

  it("accepts valid XLSX student imports by file signature", () => {
    const ws = utils.aoa_to_sheet([
      ["admissionNumber", "fullName"],
      ["S1A-002", "Grace Hopper"],
    ]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Students");
    const buffer = Buffer.from(write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer);
    const file = {
      buffer,
      originalname: "students.xlsx",
      mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: buffer.length,
    } as const;
    expect(validateStudentImportUpload(file)).toEqual({ kind: "xlsx" });
  });

  it("rejects invalid student import file types", () => {
    const file = {
      buffer: Buffer.from("not a spreadsheet"),
      originalname: "students.gif",
      mimetype: "image/gif",
      size: 17,
    } as const;
    expect(() => validateStudentImportUpload(file)).toThrow(/Unsupported file type/i);
  });

  it("rejects empty uploads", () => {
    const file = {
      buffer: Buffer.alloc(0),
      originalname: "empty.csv",
      mimetype: "text/csv",
      size: 0,
    } as const;
    expect(() => ensureNonEmptyUpload(file, "The student import file")).toThrow(/empty/i);
  });

  it("accepts valid scan images and PDFs", () => {
    expect(validateScanUpload({
      buffer: Buffer.from("not-a-real-png"),
      originalname: "scan.png",
      mimetype: "image/png",
      size: 14,
    } as const)).toEqual({ kind: "image" });

    expect(validateScanUpload({
      buffer: Buffer.from("%PDF-1.4 hello"),
      originalname: "scan.pdf",
      mimetype: "application/pdf",
      size: 14,
    } as const)).toEqual({ kind: "pdf" });
  });

  it("rejects invalid scan file types", () => {
    expect(() => validateScanUpload({
      buffer: Buffer.from("a,b,c"),
      originalname: "scan.csv",
      mimetype: "text/csv",
      size: 5,
    } as const)).toThrow(/Unsupported file type/i);
  });
});
