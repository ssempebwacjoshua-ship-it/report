import { describe, expect, it } from "vitest";
import { toAssessmentType } from "../../server/services/marksImportValidator";

describe("toAssessmentType", () => {
  it("passes standard types through unchanged", () => {
    expect(toAssessmentType("BOT")).toBe("BOT");
    expect(toAssessmentType("MOT")).toBe("MOT");
    expect(toAssessmentType("EOT")).toBe("EOT");
  });

  it("normalizes Mid Term aliases to MOT", () => {
    expect(toAssessmentType("Mid Term")).toBe("MOT");
    expect(toAssessmentType("Midterm")).toBe("MOT");
    expect(toAssessmentType("Mid-Term")).toBe("MOT");
    expect(toAssessmentType("mid term")).toBe("MOT");
    expect(toAssessmentType("MIDTERM")).toBe("MOT");
    expect(toAssessmentType("MID-TERM")).toBe("MOT");
  });

  it("trims whitespace before normalizing", () => {
    expect(toAssessmentType("  BOT  ")).toBe("BOT");
    expect(toAssessmentType("  Mid Term  ")).toBe("MOT");
  });
});

