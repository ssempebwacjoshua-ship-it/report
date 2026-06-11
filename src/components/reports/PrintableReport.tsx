import type { StudentReportCard } from "../../shared/types/reports";
import { StudentReportDetail } from "./StudentReportDetail";

export function PrintableReport({ card }: { card: StudentReportCard | null }) {
  return (
    <div className="print:block">
      <StudentReportDetail card={card} />
    </div>
  );
}
