import { describe, expect, it } from "vitest";
import { A_LEVEL_SUBJECTS, NURSERY_SUBJECTS, O_LEVEL_SUBJECTS, PRIMARY_SUBJECTS } from "../../shared/constants/subjects";

describe("seed expectations", () => {
  it("keeps the O-Level seed subject list stable", () => {
    expect(O_LEVEL_SUBJECTS.map((subject) => subject.name)).toEqual(
      expect.arrayContaining(["English", "Mathematics", "Biology", "CRE/IRE", "Computer Studies"]),
    );
  });

  it("keeps default subjects available for every school section", () => {
    expect(NURSERY_SUBJECTS.map((subject) => subject.name)).toContain("Literacy");
    expect(PRIMARY_SUBJECTS.map((subject) => subject.name)).toContain("Social Studies");
    expect(A_LEVEL_SUBJECTS.map((subject) => subject.name)).toContain("General Paper");
  });
});

