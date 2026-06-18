import { describe, expect, it } from "vitest";
import { O_LEVEL_SUBJECTS } from "../../shared/constants/subjects";

describe("seed expectations", () => {
  it("keeps the O-Level seed subject list stable", () => {
    expect(O_LEVEL_SUBJECTS).toHaveLength(15);
    expect(O_LEVEL_SUBJECTS.map((subject) => subject.name)).toContain("Fine Art");
  });
});

