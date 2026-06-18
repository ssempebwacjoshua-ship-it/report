import { describe, expect, it } from "vitest";
import {
  parseLegacyCombinedClassCode,
  resolveCanonicalClassAndStreamInput,
  resolveCanonicalClassFromInput,
} from "../../shared/utils/classStreamNormalization";

describe("class/stream normalization", () => {
  it("resolves canonical class aliases without stream suffixes", () => {
    expect(resolveCanonicalClassFromInput("S1")?.code).toBe("S1");
    expect(resolveCanonicalClassFromInput("Senior One")?.code).toBe("S1");
    expect(resolveCanonicalClassFromInput("P5")?.code).toBe("P5");
  });

  it("splits combined class and stream inputs into canonical class + stream", () => {
    expect(resolveCanonicalClassAndStreamInput("Senior 1 A", "")).toEqual({
      className: "Senior 1",
      classCode: "S1",
      streamName: "A",
      streamCode: "A",
      combinedInput: true,
    });

    expect(resolveCanonicalClassAndStreamInput("S1A", "")).toEqual({
      className: "Senior 1",
      classCode: "S1",
      streamName: "A",
      streamCode: "A",
      combinedInput: true,
    });

    expect(resolveCanonicalClassAndStreamInput("Primary 5 Blue", "")).toEqual({
      className: "P5",
      classCode: "P5",
      streamName: "Blue",
      streamCode: "BLUE",
      combinedInput: true,
    });

    expect(resolveCanonicalClassAndStreamInput("Senior 1", "A")).toEqual({
      className: "Senior 1",
      classCode: "S1",
      streamName: "A",
      streamCode: "A",
      combinedInput: false,
    });
  });

  it("derives repair targets from legacy combined class codes", () => {
    expect(parseLegacyCombinedClassCode("S1A")).toEqual({ parentCode: "S1", streamSuffix: "A" });
    expect(parseLegacyCombinedClassCode("Senior 1 A")).toEqual({ parentCode: "S1", streamSuffix: "A" });
    expect(parseLegacyCombinedClassCode("Primary 5 Blue")).toEqual({ parentCode: "P5", streamSuffix: "Blue" });
  });
});


