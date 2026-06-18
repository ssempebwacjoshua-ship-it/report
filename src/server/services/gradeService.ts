import { GRADE_BANDS } from "../../shared/constants/grades";
import type { GradingScaleSettings } from "../../shared/types/settings";

export function gradeForAverage(average: number | null, grading?: GradingScaleSettings): string | null {
  if (average == null || Number.isNaN(average)) return null;
  if (grading) {
    return grading.grades.find((grade) => average >= grade.minScore && average <= grade.maxScore)?.label ?? "F9";
  }
  return GRADE_BANDS.find((band) => average >= band.min)?.grade ?? "F9";
}

export function roundMark(value: number): number {
  return Math.round(value * 10) / 10;
}

