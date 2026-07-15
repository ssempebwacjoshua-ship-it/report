import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttendanceNfcPrintDocument } from "../../components/attendance/AttendanceNfcPrintDocument";

describe("AttendanceNfcPrintDocument", () => {
  it("renders a compact printable attendance table with hidden screen page label", () => {
    render(
      <AttendanceNfcPrintDocument
        schoolName="Test School"
        logoUrl="https://cdn.example.com/logo.png"
        contactLine="Kampala | +256700000000 | admin@test.school"
        title="Daily Attendance Register"
        generatedAt="12 Jul 2026, 08:15"
        scopeLabel="Session-based classroom attendance activity"
        metadata={[
          { label: "Date", value: "12 Jul 2026" },
          { label: "Class", value: "Senior 1" },
        ]}
        summary={[
          { label: "Total students", value: "2" },
          { label: "Present", value: "1" },
        ]}
        rows={[
          {
            id: "row-1",
            admissionNumber: "A-001",
            studentName: "Ada Lovelace",
            studentType: "Day Scholar",
            status: "Present",
            firstSeen: "12 Jul 2026, 08:01",
            lastMovement: "12 Jul 2026, 08:30",
            source: "Main Gate",
            remarks: "On campus",
          },
        ]}
        emptyMessage="No rows."
        showSource
      />,
    );

    expect(screen.getByText("School Connect")).toBeInTheDocument();
    expect(screen.getByText("Daily Attendance Register")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(screen.getByTestId("attendance-preview-table")).getByText("Present")).toHaveClass("attendance-preview-status");
    expect(screen.getByLabelText(/report metadata/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/report summary/i)).toBeInTheDocument();
    expect(screen.getByText(/session-based classroom attendance activity/i)).toBeInTheDocument();
    expect(document.querySelector(".attendance-preview-page-number")).toBeInTheDocument();
  });
});
