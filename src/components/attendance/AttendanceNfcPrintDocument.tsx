const EM_DASH = "\u2014";

type PrintItem = { label: string; value: string };

type PrintRow = {
  id: string;
  admissionNumber: string;
  studentName: string;
  studentType: string;
  status: string;
  firstSeen: string;
  lastMovement: string;
  source: string;
  remarks: string;
};

export type AttendanceNfcPrintDocumentProps = {
  schoolName: string;
  logoUrl?: string | null;
  contactLine: string;
  title: string;
  generatedAt: string;
  scopeLabel: string;
  metadata: PrintItem[];
  summary: PrintItem[];
  rows: PrintRow[];
  emptyMessage: string;
  showSource: boolean;
};

export function AttendanceNfcPrintDocument(props: AttendanceNfcPrintDocumentProps) {
  return (
    <article data-testid="attendance-preview-sheet" className="attendance-preview-sheet report-print-page">
      <header className="attendance-preview-header">
        <div className="attendance-preview-brand">
          {props.logoUrl ? (
            <img className="attendance-preview-logo" src={props.logoUrl} alt={`${props.schoolName} logo`} />
          ) : null}
          <div className="min-w-0">
            <p className="attendance-preview-overline">School Connect</p>
            <h2 className="attendance-preview-school">{props.schoolName}</h2>
            <p className="attendance-preview-contact">{props.contactLine || EM_DASH}</p>
          </div>
        </div>
        <div className="attendance-preview-heading">
          <p className="attendance-preview-title">{props.title}</p>
          <p className="attendance-preview-generated">Generated {props.generatedAt}</p>
        </div>
      </header>

      <section className="attendance-preview-meta" aria-label="Report metadata">
        {props.metadata.map((item) => (
          <div key={item.label} className="attendance-preview-meta-card">
            <span className="attendance-preview-meta-label">{item.label}</span>
            <span className="attendance-preview-meta-value">{item.value || EM_DASH}</span>
          </div>
        ))}
      </section>

      <section className="attendance-preview-summary" aria-label="Report summary">
        {props.summary.map((item) => (
          <div key={item.label} className="attendance-preview-summary-card">
            <span className="attendance-preview-summary-label">{item.label}</span>
            <span className="attendance-preview-summary-value">{item.value || EM_DASH}</span>
          </div>
        ))}
      </section>

      <div className="attendance-preview-table-wrap">
        <table data-testid="attendance-preview-table" className="attendance-preview-table">
          <colgroup>
            <col className="attendance-preview-col-number" />
            <col className="attendance-preview-col-admission" />
            <col className="attendance-preview-col-student" />
            <col className="attendance-preview-col-type" />
            <col className="attendance-preview-col-status" />
            <col className="attendance-preview-col-time" />
            <col className="attendance-preview-col-time" />
            {props.showSource ? <col className="attendance-preview-col-source" /> : null}
            <col className="attendance-preview-col-remarks" />
          </colgroup>
          <thead>
            <tr>
              <th className="attendance-preview-col-number">No.</th>
              <th className="attendance-preview-col-admission">Admission No.</th>
              <th className="attendance-preview-col-student">Student name</th>
              <th className="attendance-preview-col-type">Student type</th>
              <th className="attendance-preview-col-status">Status</th>
              <th className="attendance-preview-col-time">First seen</th>
              <th className="attendance-preview-col-time">Last movement / checkout</th>
              {props.showSource ? <th className="attendance-preview-col-source">Reader / Source</th> : null}
              <th className="attendance-preview-col-remarks">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.length > 0 ? (
              props.rows.map((row, index) => {
                const statusSlug = (row.status || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-");
                return (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td className="attendance-preview-cell-mono">{row.admissionNumber || EM_DASH}</td>
                    <td>{row.studentName || EM_DASH}</td>
                    <td>{row.studentType || EM_DASH}</td>
                    <td>
                      <span className={`attendance-preview-status attendance-preview-status-${statusSlug}`}>
                        {row.status || EM_DASH}
                      </span>
                    </td>
                    <td>{row.firstSeen || EM_DASH}</td>
                    <td>{row.lastMovement || EM_DASH}</td>
                    {props.showSource ? <td>{row.source || EM_DASH}</td> : null}
                    <td>{row.remarks || EM_DASH}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={props.showSource ? 9 : 8} className="attendance-preview-empty">
                  {props.emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="attendance-preview-footer">
        <span>{props.schoolName}</span>
        <span>{props.scopeLabel}</span>
        <span className="attendance-preview-page-number" aria-label="Page number" aria-hidden="true" />
      </footer>
    </article>
  );
}
