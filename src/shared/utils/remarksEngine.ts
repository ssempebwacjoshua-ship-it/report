export type PerformanceBand = "EXCELLENT" | "VERY_GOOD" | "GOOD" | "FAIR" | "WEAK";

export type RemarksResult = {
  band: PerformanceBand;
  classTeacherComment: string;
  headTeacherComment: string;
};

const SCORE_BANDS: Array<{ min: number; max: number; band: PerformanceBand }> = [
  { min: 85, max: 100, band: "EXCELLENT" },
  { min: 70, max: 84,  band: "VERY_GOOD" },
  { min: 55, max: 69,  band: "GOOD" },
  { min: 40, max: 54,  band: "FAIR" },
  { min:  0, max: 39,  band: "WEAK" },
];

const CLASS_TEACHER_REMARKS: Record<PerformanceBand, string> = {
  EXCELLENT: "An excellent performance. The learner has shown strong understanding and consistent effort. Keep it up.",
  VERY_GOOD: "A very good performance. The learner is progressing well and should maintain the effort.",
  GOOD:      "A good performance. With more consistency and revision, the learner can improve further.",
  FAIR:      "A fair performance. The learner should revise regularly and seek support in weaker areas.",
  WEAK:      "The learner needs serious improvement. More effort, guidance, and regular revision are required.",
};

const HEAD_TEACHER_REMARKS: Record<PerformanceBand, string> = {
  EXCELLENT: "Commendable work this term. This learner is setting a fine example and should continue with the same dedication.",
  VERY_GOOD: "A pleasing performance. The learner has demonstrated commitment and should strive to reach the top.",
  GOOD:      "A satisfactory performance. I encourage this learner to work harder and seek help where needed.",
  FAIR:      "This learner must put in more effort. Regular study and guidance from teachers is strongly encouraged.",
  WEAK:      "Urgent improvement is needed. I urge the learner and parents to work closely with teachers this coming term.",
};

export function getBandForAverage(average: number): PerformanceBand {
  for (const { min, max, band } of SCORE_BANDS) {
    if (average >= min && average <= max) return band;
  }
  return "WEAK";
}

export function generateRemarks(average: number | null): RemarksResult | null {
  if (average == null) return null;
  const band = getBandForAverage(Math.max(0, Math.min(100, average)));
  return {
    band,
    classTeacherComment: CLASS_TEACHER_REMARKS[band],
    headTeacherComment: HEAD_TEACHER_REMARKS[band],
  };
}
