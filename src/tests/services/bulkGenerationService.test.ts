import { describe, expect, it } from "vitest";
import { fillTemplate, resolvePlaceholder } from "../../server/services/bulkGenerationService";

describe("bulkGenerationService placeholder replacement", () => {
  it("resolves exact, normalized, dotted, and missing placeholders", () => {
    const data = {
      name: "Ada Lovelace",
      studentName: "Ada Lovelace",
      AdmissionNo: "S1A-001",
      parent_phone: "0777123456",
      student: {
        fullName: "Ada Byron",
      },
    };

    expect(resolvePlaceholder(data, "name")).toBe("Ada Lovelace");
    expect(resolvePlaceholder(data, "Name")).toBe("Ada Lovelace");
    expect(resolvePlaceholder(data, "student name")).toBe("Ada Lovelace");
    expect(resolvePlaceholder(data, "Admission No")).toBe("S1A-001");
    expect(resolvePlaceholder(data, "parent-phone")).toBe("0777123456");
    expect(resolvePlaceholder(data, "student.fullName")).toBe("Ada Byron");
    expect(resolvePlaceholder(data, "missingField")).toBe("");
  });

  it("fills nested template JSON without breaking quotes or newlines", () => {
    const template = JSON.stringify({
      title: "{{student name}}",
      details: {
        admission: "{{Admission No}}",
        parent: "{{parent-phone}}",
        bio: "{{student.fullName}}",
        missing: "{{missingField}}",
        note: "{{note}}",
      },
    });
    const data = {
      studentName: 'Ada "The Analyst"\nLovelace',
      admissionNo: "S1A-001",
      parentPhone: "0777123456",
      student: {
        fullName: "Ada Byron Lovelace",
      },
      note: "Line 1\nLine 2",
    };

    const filled = fillTemplate(template, data);
    expect(JSON.parse(filled)).toEqual({
      title: 'Ada "The Analyst"\nLovelace',
      details: {
        admission: "S1A-001",
        parent: "0777123456",
        bio: "Ada Byron Lovelace",
        missing: "",
        note: "Line 1\nLine 2",
      },
    });
  });
});
