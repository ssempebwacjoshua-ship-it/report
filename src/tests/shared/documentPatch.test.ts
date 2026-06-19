import { describe, expect, it } from "vitest";
import { applyDocumentPatches, parseAiEditResponse } from "../../shared/documentPatch";

describe("document patch engine", () => {
  it("applies replace_text when the old text exists", () => {
    const result = applyDocumentPatches("Hello world", [
      { type: "replace_text", oldText: "world", newText: "lawyer" },
    ]);

    expect(result.after).toBe("Hello lawyer");
    expect(result.changed).toBe(true);
    expect(result.appliedCount).toBe(1);
    expect(result.rejectedCount).toBe(0);
  });

  it("rejects replace_text when the old text is missing", () => {
    const parsed = parseAiEditResponse({
      summary: "Try to replace text.",
      operations: [{ type: "replace_text", oldText: "", newText: "lawyer" }],
    });
    const result = applyDocumentPatches("Hello world", parsed.operations);

    expect(result.after).toBe("Hello world");
    expect(result.changed).toBe(false);
    expect(result.appliedCount).toBe(0);
    expect(parsed.rejectedOperations).toHaveLength(1);
  });

  it("rejects identical replace_text values", () => {
    const parsed = parseAiEditResponse({
      summary: "No real change.",
      operations: [{ type: "replace_text", oldText: "Hello", newText: "Hello" }],
    });

    const result = applyDocumentPatches("Hello world", parsed.operations);
    expect(result.changed).toBe(false);
    expect(result.appliedCount).toBe(0);
    expect(parsed.rejectedOperations).toHaveLength(1);
  });

  it("applies insert_after when the anchor exists", () => {
    const result = applyDocumentPatches("Client details\nFacts", [
      { type: "insert_after", anchorText: "Client details", insertText: "Name: Jane Lawyer" },
    ]);

    expect(result.after).toContain("Client details");
    expect(result.after).toContain("Name: Jane Lawyer");
    expect(result.changed).toBe(true);
    expect(result.appliedCount).toBe(1);
  });

  it("rejects insert_after when the anchor is missing", () => {
    const result = applyDocumentPatches("Client details\nFacts", [
      { type: "insert_after", anchorText: "Missing anchor", insertText: "Name: Jane Lawyer" },
    ]);

    expect(result.after).toBe("Client details\nFacts");
    expect(result.changed).toBe(false);
    expect(result.rejectedCount).toBe(1);
  });

  it("returns no changes when operations are empty", () => {
    const parsed = parseAiEditResponse({ summary: "", operations: [] });
    const result = applyDocumentPatches("Client details\nFacts", parsed.operations);

    expect(parsed.summary).toBe("No changes applied.");
    expect(result.after).toBe("Client details\nFacts");
    expect(result.changed).toBe(false);
    expect(result.appliedCount).toBe(0);
    expect(result.rejectedCount).toBe(0);
  });

  it("produces a real before and after diff when content changes", () => {
    const before = "Dear Client\nBody";
    const result = applyDocumentPatches(before, [
      { type: "append_section", heading: "Next steps", body: "Review the draft and confirm the deadline." },
    ]);

    expect(result.before).toBe(before);
    expect(result.after).not.toBe(before);
    expect(result.after).toContain("Next steps:");
    expect(result.changed).toBe(true);
  });
});
