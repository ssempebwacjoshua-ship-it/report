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

export type DashboardInventorySummary = {
  itemsTracked: number;
  lowStock: number;
  reportingToday: number;
  requirementsReceived: number;
  reconciliationIssues: number;
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
  inventory: DashboardInventorySummary;
  recentBatches: RecentBatch[];
  recentActivity: DashboardActivity[];
};

export type DashboardAttendanceSummary = {
  date: string;
  timezone: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number;
  onCampus: number;
  offCampus: number;
  dayScholarsPresent?: number;
  dayScholarsAbsent?: number;
  boardersPresent?: number;
  boardersNotSeenToday?: number;
  lastUpdatedAt: string;
  latestScans?: Array<{
    studentId: string;
    studentName: string;
    admissionNumber: string;
    className: string | null;
    streamName: string | null;
    eventType: string;
    status: "PRESENT" | "LATE" | "DEPARTED" | "BLOCKED";
    occurredAt: string;
    readerUsed: string | null;
    offlineSynced: boolean;
  }>;
  classSummaries?: Array<{
    className: string;
    streamName: string | null;
    totalStudents: number;
    present: number;
    late: number;
    absent: number;
    onCampus: number;
    offCampus: number;
  }>;
};

