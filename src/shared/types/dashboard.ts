export type ActiveTerm = {
  id: string;
  name: string;
  academicYear: string;
};

export type RecentBatch = {
  id: string;
  uploadedAt: string; // ISO date string
  rowCount: number;
  status: "COMMITTED" | "FAILED" | "DRY_RUN";
};

export type DashboardActivity = {
  action: string;
  label: string;
  occurredAt: string; // ISO date string
};

export type DashboardWorkflow = {
  marksUploaded: number;
  reviewed: number;
  generated: number;
  approved: number;
  released: number;
};

export type DashboardStats = {
  schoolName: string;
  activeTerm: ActiveTerm | null;
  enrolledStudents: number;
  /** Committed batches where no marks have been finalized yet */
  marksUploadsPendingReview: number;
  /** IssuedReports with status ISSUED */
  reportsIssuedCount: number;
  /** IssuedReports with sentAt set */
  reportsReleasedCount: number;
  workflow: DashboardWorkflow;
  recentBatches: RecentBatch[];
  recentActivity: DashboardActivity[];
};

