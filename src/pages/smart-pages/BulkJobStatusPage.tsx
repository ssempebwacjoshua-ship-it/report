import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { getBulkJobDetail, type BulkJobSummary, type BulkJobOutput } from "../../client/collectionsClient";
import { BrandedLoader } from "../../components/BrandedLoader";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  PROCESSING: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  FAILED: "bg-red-100 text-red-700",
  DONE: "bg-green-100 text-green-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

export function BulkJobStatusPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<BulkJobSummary | null>(null);
  const [outputs, setOutputs] = useState<BulkJobOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getBulkJobDetail(id);
      setJob(data.job);
      setOutputs(data.outputs);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load job.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!job) return;
    const isActive = job.status === "PENDING" || job.status === "PROCESSING";
    if (isActive && !intervalRef.current) {
      intervalRef.current = setInterval(() => { void load(); }, 3000);
    } else if (!isActive && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [job, load]);

  const origin = window.location.origin;

  if (loading) return <BrandedLoader message="Loading bulk job..." />;
  if (!job) return <div className="p-8 text-center text-sm text-red-500">{error ?? "Job not found."}</div>;

  const isActive = job.status === "PENDING" || job.status === "PROCESSING";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate("/collections")}
          className="text-sm text-slate-400 hover:text-slate-700"
        >
          ? Collections
        </button>
        <span className="text-slate-200">/</span>
        <h1 className="text-xl font-black text-slate-900">Bulk Job</h1>
        <StatusBadge status={job.status} />
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-400">Collection</p>
            <p className="font-bold text-slate-900">{job.collectionName}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Records</p>
            <p className="font-bold text-slate-900">{job.totalRecords}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Processed</p>
            <p className="font-bold text-green-700">{job.processedRecords}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Failed</p>
            <p className="font-bold text-red-600">{job.failedRecords}</p>
          </div>
        </div>

        {isActive ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Progress</span>
              <span>{job.progressPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${job.progressPct}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500 font-medium">Intent</p>
          <p className="mt-1 text-sm text-slate-700">{job.intent}</p>
        </div>

        {job.completedAt ? (
          <p className="mt-3 text-xs text-slate-400">
            Completed {new Date(job.completedAt).toLocaleString()}
          </p>
        ) : null}
      </div>

      {outputs.length > 0 ? (
        <div>
          <h2 className="mb-3 text-sm font-bold text-slate-700">Generated Documents</h2>
          <div className="grid gap-2">
            {outputs.map((output) => {
              const label = output.recordData
                ? (
                    output.recordData.name ??
                    output.recordData.studentName ??
                    output.recordData.fullName ??
                    output.recordData.firstName ??
                    "Record"
                  )
                : "Record";
              return (
                <div
                  key={output.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{String(label)}</p>
                    {output.error ? (
                      <p className="text-xs text-red-500">{output.error}</p>
                    ) : null}
                  </div>
                  <StatusBadge status={output.status} />
                  {output.publishToken ? (
                    <a
                      href={`${origin}/p/${output.publishToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                    >
                      View
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {isActive ? (
        <p className="mt-6 text-center text-xs text-slate-400">Auto-refreshing every 3 seconds?</p>
      ) : null}
    </div>
  );
}

