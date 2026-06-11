import type { MarksheetStudent } from "../../shared/types/marksheets";

const EXAM_LABELS: Record<string, string> = {
  BOT: "BOT — Beginning of Term",
  MOT: "MOT — Mid Term",
  EOT: "EOT — End of Term",
};

// Rows that fit comfortably on first page (full header) and continuation pages (compact header)
const ROWS_FIRST = 26;
const ROWS_CONT = 34;

type PageSegment = { students: MarksheetStudent[]; startIndex: number };

function buildPages(students: MarksheetStudent[]): PageSegment[] {
  if (students.length === 0) return [{ students: [], startIndex: 0 }];
  const pages: PageSegment[] = [];
  let offset = 0;
  let capacity = ROWS_FIRST;
  while (offset < students.length) {
    pages.push({ students: students.slice(offset, offset + capacity), startIndex: offset });
    offset += capacity;
    capacity = ROWS_CONT;
  }
  return pages;
}

function computeMarksheetId(
  className: string,
  streamName: string,
  subjectName: string,
  examType: string,
  termName: string,
): string {
  const cls = className.replace(/\s+/g, "").toUpperCase().slice(0, 4);
  const sub = subjectName.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4);
  const trm = termName.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 2);
  return `MS-${new Date().getFullYear()}-${cls}-${streamName.toUpperCase()}-${sub}-${examType}-${trm}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

// ── Signature line — label | ________ name ________ | Signature: _____ | Date: _____
function SigRow({ label }: { label: string }) {
  return (
    <div className="marksheet-sig-row">
      <span className="marksheet-sig-label">{label}:</span>
      <span className="marksheet-sig-line" />
      <span className="marksheet-sig-sublabel">Signature:</span>
      <span className="marksheet-sig-short" />
      <span className="marksheet-sig-sublabel">Date:</span>
      <span className="marksheet-sig-date" />
    </div>
  );
}

// ── Table header — repeated on every page
function TableHead() {
  return (
    <thead>
      <tr className="marksheet-thead-row">
        <th className="marksheet-th text-center" style={{ width: "32px" }}>
          No.
        </th>
        <th className="marksheet-th text-left" style={{ width: "78px" }}>
          Adm. No.
        </th>
        <th className="marksheet-th text-left">Student Name</th>
        <th className="marksheet-th text-center" style={{ width: "88px" }}>
          Written Mark
        </th>
        <th className="marksheet-th text-center" style={{ width: "82px" }}>
          Split Mark Entry
        </th>
        <th className="marksheet-th text-left" style={{ width: "110px" }}>
          Remarks
        </th>
      </tr>
    </thead>
  );
}

type Props = {
  schoolName: string;
  academicYear: string;
  termName: string;
  className: string;
  streamName: string;
  subjectName: string;
  examType: string;
  students: MarksheetStudent[];
};

export function PrintableMarksheet({
  schoolName,
  academicYear,
  termName,
  className,
  streamName,
  subjectName,
  examType,
  students,
}: Props) {
  const today = formatDate(new Date());
  const marksheetId = computeMarksheetId(className, streamName, subjectName, examType, termName);
  const examLabel = EXAM_LABELS[examType] ?? examType;
  const pages = buildPages(students);
  const totalPages = pages.length;

  return (
    <div className="marksheet-print-area">
      {pages.map(({ students: pageStudents, startIndex }, pageIndex) => {
        const isFirst = pageIndex === 0;
        const isLast = pageIndex === totalPages - 1;

        return (
          <div
            key={pageIndex}
            className={`marksheet-page${!isLast ? " marksheet-page-break" : ""}`}
          >
            {/* ══ FULL HEADER — first page only ══ */}
            {isFirst && (
              <div className="marksheet-header-box">
                <div className="marksheet-title-block">
                  <p className="marksheet-school-name">{schoolName}</p>
                  <p className="marksheet-sheet-title">ACADEMIC MARKSHEET</p>
                </div>

                <div className="marksheet-meta-grid">
                  <div>
                    <span className="marksheet-meta-key">Academic Year:</span> {academicYear}
                  </div>
                  <div>
                    <span className="marksheet-meta-key">Term:</span> {termName}
                  </div>
                  <div>
                    <span className="marksheet-meta-key">Class:</span> {className}
                  </div>
                  <div>
                    <span className="marksheet-meta-key">Stream:</span> {streamName}
                  </div>
                  <div>
                    <span className="marksheet-meta-key">Subject:</span> {subjectName}
                  </div>
                  <div>
                    <span className="marksheet-meta-key">Exam Type:</span> {examLabel}
                  </div>
                  <div>
                    <span className="marksheet-meta-key">Marksheet ID:</span>{" "}
                    <span className="marksheet-id-value">{marksheetId}</span>
                  </div>
                  <div>
                    <span className="marksheet-meta-key">Generated:</span> {today}
                  </div>
                </div>

                {/* Signatures on first page only when it is the ONLY page */}
                {totalPages === 1 && (
                  <div className="marksheet-sig-section">
                    <SigRow label="Class Teacher" />
                    <SigRow label="Data Entry Operator" />
                    <SigRow label="Head Teacher Approval" />
                  </div>
                )}
              </div>
            )}

            {/* ══ CONTINUATION HEADER — subsequent pages ══ */}
            {!isFirst && (
              <div className="marksheet-cont-header">
                <p className="marksheet-cont-title">
                  {schoolName} — ACADEMIC MARKSHEET — CONTINUATION
                </p>
                <div className="marksheet-cont-meta">
                  <span>
                    {className} / {streamName} / {subjectName} / {examType} — {termName}
                  </span>
                  <span className="marksheet-cont-page">
                    Page {pageIndex + 1} of {totalPages}
                  </span>
                </div>
                <p className="marksheet-cont-id">Marksheet ID: {marksheetId}</p>
              </div>
            )}

            {/* ══ TABLE ══ */}
            <table className="marksheet-table">
              <TableHead />
              <tbody>
                {pageStudents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="marksheet-td marksheet-empty-cell">
                      No students found for this class and stream.
                    </td>
                  </tr>
                )}
                {pageStudents.map((student, i) => {
                  const globalRow = startIndex + i;
                  return (
                    <tr
                      key={student.id}
                      className="marksheet-row"
                      style={{ backgroundColor: globalRow % 2 === 0 ? "#fff" : "#f8fafc" }}
                    >
                      <td className="marksheet-td marksheet-td-num">{globalRow + 1}</td>
                      <td className="marksheet-td marksheet-td-adm">{student.admissionNumber}</td>
                      <td className="marksheet-td marksheet-td-name">
                        {student.firstName} {student.lastName}
                      </td>
                      {/* Written Mark — clean empty writing cell */}
                      <td className="marksheet-td" />
                      {/* Split mark entry — one cell, three equal sections divided by thin vertical lines */}
                      <td className="marksheet-td marksheet-td-split">
                        <div className="marksheet-split-inner">
                          <span className="marksheet-split-part" />
                          <span className="marksheet-split-part" />
                          <span className="marksheet-split-part marksheet-split-last" />
                        </div>
                      </td>
                      {/* Remarks — clean empty writing cell */}
                      <td className="marksheet-td" />
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* ══ SIGNATURES — last page of a multi-page marksheet ══ */}
            {isLast && totalPages > 1 && (
              <div className="marksheet-sig-section">
                <SigRow label="Class Teacher" />
                <SigRow label="Data Entry Operator" />
                <SigRow label="Head Teacher Approval" />
              </div>
            )}

            {/* ══ FOOTER ══ */}
            <div className="marksheet-footer">
              <span>
                Valid entries: 0–100 &nbsp;·&nbsp; <strong>AB</strong> = Absent &nbsp;·&nbsp;{" "}
                <strong>EX</strong> = Exempted &nbsp;·&nbsp; Blank ≠ Zero &nbsp;·&nbsp; Total:{" "}
                {students.length} students
              </span>
              {!isLast ? (
                <span className="marksheet-footer-continued">Continued on next page →</span>
              ) : (
                <span className="marksheet-footer-id">
                  {marksheetId}
                  {totalPages > 1 ? ` · Page ${pageIndex + 1} of ${totalPages}` : ""} · {today}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
