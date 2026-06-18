import { describe, expect, it } from "vitest";
import { parseMarksCsv } from "../../server/adapters/csvMarksParser";

describe("csvMarksParser", () => {
  it("parses the required import shape", () => {
    const rows = parseMarksCsv(`admissionNumber,studentName,class,stream,subject,term,examType,marks,comments
S1A-001,Kampala Ssempebwa,Senior 1 A,A,English Language,Term 1,BOT,88,Good`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ admissionNumber: "S1A-001", examType: "BOT", marks: "88" });
  });
});

