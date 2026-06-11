import { GRADE_BANDS } from "../../shared/constants/grades";

export function gradeForAverage(average: number | null): string | null {
  if (average == null || Number.isNaN(average)) return null;
  return GRADE_BANDS.find((band) => average >= band.min)?.grade ?? "F9";
}

export function roundMark(value: number): number {
  return Math.round(value * 10) / 10;
}
