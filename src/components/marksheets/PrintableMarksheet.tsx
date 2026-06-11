import type { MarksheetStudent } from "../../shared/types/marksheets";

const EXAM_LABELS: Record<string, string> = {
  BOT: "BOT — Beginning of Term",
  MOT: "MOT — Mid Term",
  EOT: "EOT — End of Term",
};

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
  const year = new Date().getFullYear();
  return `MS-${year}-${cls}-${streamName.toUpperCase()}-${sub}-${examType}-${trm}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
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

  return (
    <div className="marksheet-print-area font-sans text-sm text-slate-900 print:text-black">
      {/* ── Header ── */}
      <div className="mb-3 border-2 border-slate-700 p-4 print:border-black">
        <div className="mb-2 text-center">
          <p className="text-xl font-bold uppercase tracking-wide">{schoolName}</p>
          <p className="mt-0.5 text-base font-semibold">ACADEMIC MARKSHEET</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div>
            <span className="font-semibold">Academic Year:</span> {academicYear}
          </div>
          <div>
            <span className="font-semibold">Term:</span> {termName}
          </div>
          <div>
            <span className="font-semibold">Class:</span> {className}
          </div>
          <div>
            <span className="font-semibold">Stream:</span> {streamName}
          </div>
          <div>
            <span className="font-semibold">Subject:</span> {subjectName}
          </div>
          <div>
            <span className="font-semibold">Exam Type:</span> {examLabel}
          </div>
          <div>
            <span className="font-semibold">Marksheet ID:</span>{" "}
            <span className="font-mono text-xs">{marksheetId}</span>
          </div>
          <div>
            <span className="font-semibold">Generated:</span> {today}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-y-2 border-t border-slate-300 pt-3 text-sm print:border-slate-700">
          <div className="flex items-end gap-4">
            <span className="shrink-0 font-semibold">Class Teacher:</span>
            <span className="flex-1 border-b border-slate-400 print:border-black" />
            <span className="shrink-0 font-semibold">Sign:</span>
            <span className="w-32 border-b border-slate-400 print:border-black" />
            <span className="shrink-0 font-semibold">Date:</span>
            <span className="w-24 border-b border-slate-400 print:border-black" />
          </div>
          <div className="flex items-end gap-4">
            <span className="shrink-0 font-semibold">Data Entry Operator:</span>
            <span className="flex-1 border-b border-slate-400 print:border-black" />
            <span className="shrink-0 font-semibold">Sign:</span>
            <span className="w-32 border-b border-slate-400 print:border-black" />
            <span className="shrink-0 font-semibold">Date:</span>
            <span className="w-24 border-b border-slate-400 print:border-black" />
          </div>
          <div className="flex items-end gap-4">
            <span className="shrink-0 font-semibold">Head Teacher Approval:</span>
            <span className="flex-1 border-b border-slate-400 print:border-black" />
            <span className="shrink-0 font-semibold">Sign:</span>
            <span className="w-32 border-b border-slate-400 print:border-black" />
            <span className="shrink-0 font-semibold">Date:</span>
            <span className="w-24 border-b border-slate-400 print:border-black" />
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="marksheet-table w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-800 text-white print:bg-slate-800 print:text-white">
              <th className="border border-slate-600 px-2 py-2 text-center font-semibold print:border-black">No.</th>
              <th className="border border-slate-600 px-2 py-2 text-left font-semibold print:border-black">Adm. No.</th>
              <th className="border border-slate-600 px-2 py-2 text-left font-semibold print:border-black">Student Name</th>
              <th className="border border-slate-600 px-3 py-2 text-center font-semibold print:border-black">
                Written Mark
                <div className="text-[10px] font-normal opacity-80">(teacher writes here)</div>
              </th>
              <th className="border border-slate-600 px-2 py-1 text-center font-semibold print:border-black">
                <div>Split Mark Entry</div>
                <div className="flex items-center justify-center gap-1 pt-0.5 text-[10px] font-normal opacity-80">
                  <span className="w-6 text-center">H</span>
                  <span className="w-6 text-center">T</span>
                  <span className="w-6 text-center">U</span>
                </div>
              </th>
              <th className="border border-slate-600 px-2 py-2 text-left font-semibold print:border-black">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => (
              <tr
                key={student.id}
                className={index % 2 === 0 ? "bg-white print:bg-white" : "bg-slate-50 print:bg-slate-50"}
              >
                <td className="border border-slate-300 px-2 py-2.5 text-center text-slate-600 print:border-slate-400">
                  {index + 1}
                </td>
                <td className="border border-slate-300 px-2 py-2.5 font-mono text-xs print:border-slate-400">
                  {student.admissionNumber}
                </td>
                <td className="border border-slate-300 px-2 py-2.5 font-medium print:border-slate-400">
                  {student.firstName} {student.lastName}
                </td>
                {/* Written mark — long blank line */}
                <td className="border border-slate-300 px-3 py-2.5 print:border-slate-400">
                  <div className="mx-auto w-28 border-b-2 border-slate-400 pb-1 print:border-black" />
                </td>
                {/* Split digit boxes */}
                <td className="border border-slate-300 px-2 py-2 print:border-slate-400">
                  <div className="flex items-end justify-center gap-1">
                    <span className="inline-block h-7 w-7 border-2 border-slate-400 print:border-black" />
                    <span className="inline-block h-7 w-7 border-2 border-slate-400 print:border-black" />
                    <span className="inline-block h-7 w-7 border-2 border-slate-400 print:border-black" />
                  </div>
                </td>
                {/* Remarks */}
                <td className="border border-slate-300 px-2 py-2.5 print:border-slate-400">
                  <div className="border-b border-slate-300 pb-1 print:border-slate-400" />
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={6} className="border border-slate-300 px-4 py-6 text-center text-slate-400 print:border-slate-400">
                  No students found for this class and stream.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer note ── */}
      <div className="mt-3 rounded border border-slate-300 bg-slate-50 px-4 py-2 text-xs text-slate-600 print:border-slate-400 print:bg-white">
        <span className="font-semibold">Valid entries:</span> 0–100 (numeric marks).{" "}
        <span className="font-semibold">AB</span> = Absent.{" "}
        <span className="font-semibold">EX</span> = Exempted.{" "}
        Leave blank if not yet assessed. <strong>Blank ≠ zero.</strong>
        <span className="ml-4 font-semibold">Total students: {students.length}</span>
      </div>
    </div>
  );
}
