import { QRCodeSVG } from "qrcode.react";
import type { MarksheetStudent } from "../../shared/types/marksheets";

const EXAM_LABELS: Record<string, string> = {
  BOT: "BOT ? Beginning of Term",
  MOT: "MOT ? Mid Term",
  EOT: "EOT ? End of Term",
};

// Rows that fit comfortably on first page (full header) and continuation pages (compact header)
const ROWS_FIRST = 24;
const ROWS_CONT = 32;

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

// Deterministic 3-digit suffix from marksheet ID (mirrors marksheetContextService.ts).
// Apply the same basic normalization as the server side (SENI->SEN1, M5->MS, O/0 swaps)
// so the printed sheet number matches what the lookup will compute.
function normalizeIdForHash(id: string): string {
  return id
    .toUpperCase()
    .replace(/[–—−]/g, "-")
    .replace(/\|/g, "I")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .map((part, i) => {
      if (i === 0) return part.replace(/^M5$/, "MS");
      if (i === 2) return part.replace(/^SEN[IL]$/, "SEN1");
      return part;
    })
    .join("-");
}

function sheetNumberSuffix(marksheetId: string): string {
  const chars = normalizeIdForHash(marksheetId).replace(/[^A-Z0-9]/g, "").toUpperCase();
  let hash = 7;
  for (let i = 0; i < chars.length; i++) {
    hash = (hash * 31 + chars.charCodeAt(i)) & 0x7fffffff;
  }
  return String(hash % 1000).padStart(3, "0");
}

function computeSheetNumber(marksheetId: string, generatedDate: Date): string {
  const y = generatedDate.getFullYear();
  const m = String(generatedDate.getMonth() + 1).padStart(2, "0");
  const d = String(generatedDate.getDate()).padStart(2, "0");
  return `${y}${m}${d}-${sheetNumberSuffix(marksheetId)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

// ── Table header ? repeated on every page
function TableHead() {
  return (
    <thead>
      <tr className="marksheet-thead-row">
        <th className="marksheet-th text-center" style={{ width: "28px" }}>
          No.
        </th>
        <th className="marksheet-th text-left" style={{ width: "72px" }}>
          Adm. No.
        </th>
        <th className="marksheet-th text-left">Student Name</th>
        <th className="marksheet-th text-center" style={{ width: "96px" }}>
          Written Mark
        </th>
        <th className="marksheet-th text-center" style={{ width: "99px" }}>
          Split Mark Entry
        </th>
        <th className="marksheet-th text-left" style={{ width: "88px" }}>
          Remarks
        </th>
      </tr>
    </thead>
  );
}

type Props = {
  schoolName: string;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  footerText: string;
  academicYear: string;
  termName: string;
  className: string;
  streamName: string;
  subjectName: string;
  examType: string;
  students: MarksheetStudent[];
  printStyle: "rich_black" | "standard";
  includeQrCode: boolean;
  includeHumanReadableMarksheetId: boolean;
  validMarkValues: string;
};

export function PrintableMarksheet({
  schoolName,
  schoolAddress = "",
  schoolPhone = "",
  schoolEmail = "",
  footerText,
  academicYear,
  termName,
  className,
  streamName,
  subjectName,
  examType,
  students,
  printStyle,
  includeQrCode,
  includeHumanReadableMarksheetId,
  validMarkValues,
}: Props) {
  const today = new Date();
  const todayStr = formatDate(today);
  const marksheetId = computeMarksheetId(className, streamName, subjectName, examType, termName);
  const sheetNumber = computeSheetNumber(marksheetId, today);
  const examLabel = EXAM_LABELS[examType] ?? examType;
  const pages = buildPages(students);
  const totalPages = pages.length;

  return (
    <div className={`marksheet-print-area marksheet-style-${printStyle}`}>
      {pages.map(({ students: pageStudents, startIndex }, pageIndex) => {
        const isFirst = pageIndex === 0;
        const isLast = pageIndex === totalPages - 1;

        return (
          <div
            key={pageIndex}
            className={`marksheet-page${!isLast ? " marksheet-page-break" : ""}`}
          >
            {/* FULL HEADER - first page only */}
            {isFirst && (
              <div className="marksheet-header-box">
                {/* Sheet Number + QR block - top right, absolute */}
                <div className="marksheet-id-qr-block">
                  <span className="marksheet-sheet-number-label">SHEET NO</span>
                  <span className="marksheet-sheet-number-value">{sheetNumber}</span>
                  {includeQrCode ? (
                    <QRCodeSVG value={marksheetId} size={58} marginSize={1} level="M" aria-label={`Marksheet QR ${marksheetId}`} />
                  ) : null}
                </div>

                <div className="marksheet-title-block">
                  <p className="marksheet-school-name">{schoolName}</p>
                  {[schoolAddress, schoolPhone, schoolEmail].filter(Boolean).length > 0 ? (
                    <p className="marksheet-school-contact">
                      {[schoolAddress, schoolPhone, schoolEmail].filter(Boolean).join(" | ")}
                    </p>
                  ) : null}
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
                    <span className="marksheet-meta-key">Generated:</span> {todayStr}
                  </div>
                  <div>
                    <span className="marksheet-meta-key">Students:</span> {students.length}
                  </div>
                </div>
              </div>
            )}

            {/* CONTINUATION HEADER - subsequent pages */}
            {!isFirst && (
              <div className="marksheet-cont-header">
                <div className="marksheet-cont-inner">
                  <div>
                    <p className="marksheet-cont-title">
                      {schoolName} - ACADEMIC MARKSHEET - CONTINUATION
                    </p>
                    <div className="marksheet-cont-meta">
                      <span>
                        {className} / {streamName} / {subjectName} / {examType} - {termName}
                      </span>
                      <span className="marksheet-cont-page">
                        Page {pageIndex + 1} of {totalPages}
                      </span>
                    </div>
                    {includeHumanReadableMarksheetId ? (
                      <p className="marksheet-cont-id">ID: {marksheetId}</p>
                    ) : null}
                  </div>
                  <div className="marksheet-cont-sheet-number">
                    <span className="marksheet-sheet-number-label">SHEET NO</span>
                    <span className="marksheet-sheet-number-value marksheet-sheet-number-small">{sheetNumber}</span>
                    {includeQrCode ? (
                      <QRCodeSVG value={marksheetId} size={38} marginSize={1} level="M" />
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {/* TABLE */}
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
                      {/* Written Mark - clean empty writing cell */}
                      <td className="marksheet-td" />
                      {/* Split mark entry - one cell, three equal sections divided by thin vertical lines */}
                      <td className="marksheet-td marksheet-td-split">
                        <div className="marksheet-split-inner">
                          <span className="marksheet-split-part" />
                          <span className="marksheet-split-part" />
                          <span className="marksheet-split-part marksheet-split-last" />
                        </div>
                      </td>
                      {/* Remarks - clean empty writing cell */}
                      <td className="marksheet-td" />
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* FOOTER */}
            <div className="marksheet-footer">
              <span className="marksheet-footer-legend">
                Valid entries: {validMarkValues} &nbsp;|&nbsp; {footerText}
              </span>
              {!isLast ? (
                <span className="marksheet-footer-continued">Continued on next page</span>
              ) : (
                <span className="marksheet-footer-id">
                  {includeHumanReadableMarksheetId ? (
                    <span className="marksheet-footer-internal-id">{marksheetId}</span>
                  ) : null}
                  <span>
                    {totalPages > 1 ? `Page ${pageIndex + 1} of ${totalPages} ? ` : ""}
                    {todayStr}
                  </span>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

