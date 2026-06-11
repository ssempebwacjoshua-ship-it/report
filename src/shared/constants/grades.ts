export const GRADE_BANDS = [
  { min: 80, grade: "D1", comment: "Excellent" },
  { min: 75, grade: "D2", comment: "Very good" },
  { min: 70, grade: "C3", comment: "Good" },
  { min: 65, grade: "C4", comment: "Credit" },
  { min: 60, grade: "C5", comment: "Credit" },
  { min: 50, grade: "C6", comment: "Pass" },
  { min: 45, grade: "P7", comment: "Basic pass" },
  { min: 40, grade: "P8", comment: "Needs support" },
  { min: 0, grade: "F9", comment: "Below standard" },
] as const;
