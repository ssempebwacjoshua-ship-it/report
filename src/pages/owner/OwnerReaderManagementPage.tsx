import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchOwnerReader,
  fetchOwnerReaders,
  requestOwnerReaderAction,
  rotateOwnerReaderToken,
  type OwnerReader,
  type OwnerReaderDetail,
} from "../../client/ownerClient";

const STATUS_OPTIONS = ["ALL", "ONLINE", "OFFLINE", "DISABLED", "ERRORS", "OTA_PENDING"] as const;
const OTA_OPTIONS = ["ALL", "PENDING", "FAILED", "INSTALLED", "NO_UPDATE"] as const;

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-UG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMemory(value: number | null | undefined) {
  if (value == null) return "-";
  return `${Math.round(value).toLocaleString("en-UG")} B`;
}

function formatRssi(value: number | null | undefined) {
  return value == null ? "-" : `${value} dBm`;
}

function statusTone(status: string) {
  const key = status.toUpperCase();
  if (key === "ONLINE") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (key === "OFFLINE") return "border-red-200 bg-red-50 text-red-700";
  if (key === "DISABLED") return "border-slate-200 bg-slate-100 text-slate-500";
  if (key === "ERRORS") return "border-amber-200 bg-amber-50 text-amber-700";
  if (key === "OTA_PENDING") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function badgeClass(onlineStatus: string) {
  return statusTone(onlineStatus);
}

function ReaderBadge({ label, tone }: { label: string; tone: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${tone}`}>{label}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-0.5 break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ReaderCard({
  reader,
}: {
  reader: OwnerReader;
}) {
  const isHealthy = reader.onlineStatus === "ONLINE";
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ReaderBadge label={reader.onlineStatus} tone={badgeClass(reader.onlineStatus)} />
            <p className="truncate text-base font-black text-slate-950">{reader.name}</p>
          </div>
          <p className="mt-1 font-mono text-xs text-slate-400">{reader.deviceKey}</p>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{reader.school?.name ?? reader.schoolId ?? "Unknown school"}</p>
        </div>
        <Link
          to={`/owner/readers/${encodeURIComponent(reader.id)}`}
          className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
        >
          View
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric label="Last heartbeat" value={formatDateTime(reader.lastHeartbeatAt ?? reader.lastSeenAt)} />
        <Metric label="Last seen" value={formatDateTime(reader.lastSeenAt)} />
        <Metric label="Firmware" value={reader.firmwareVersion ?? "-"} />
        <Metric label="OTA status" value={reader.otaStatus ?? "UNKNOWN"} />
        <Metric label="Queue" value={`${reader.queueDepth}`} />
        <Metric label="Wi-Fi RSSI" value={formatRssi(reader.lastRssi)} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <span>{reader.locationName ?? reader.location ?? "No location"}</span>
        <span>•</span>
        <span>{reader.lastIp ?? "No IP"}</span>
        <span>•</span>
        <span>{reader.heartbeatStale ? "Stale heartbeat" : isHealthy ? "Healthy" : "Disabled"}</span>
      </div>
    </article>
  );
}

export function OwnerReaderManagementPage() {
  const [readers, setReaders] = useState<OwnerReader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("ALL");
  const [otaStatus, setOtaStatus] = useState<(typeof OTA_OPTIONS)[number]>("ALL");
  const [firmwareVersion, setFirmwareVersion] = useState("");

  async function loadReaders() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchOwnerReaders({
        search,
        schoolId,
        status,
        otaStatus,
        firmwareVersion,
      });
      setReaders(data.readers);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load readers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReaders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, schoolId, status, otaStatus, firmwareVersion]);

  const schools = useMemo(() => {
    const seen = new Map<string, { id: string; code: string; name: string }>();
    for (const reader of readers) {
      if (reader.school?.id) {
        seen.set(reader.school.id, reader.school);
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [readers]);

  const filteredReaders = readers;
  const stats = useMemo(() => ({
    total: readers.length,
    online: readers.filter((reader) => reader.onlineStatus === "ONLINE").length,
    offline: readers.filter((reader) => reader.onlineStatus === "OFFLINE").length,
    otaPending: readers.filter((reader) => reader.otaStatus && ["UPDATE_AVAILABLE", "DEFERRED", "PENDING"].includes(String(reader.otaStatus))).length,
    errors: readers.filter((reader) => Boolean(
      (reader.lastScanStatus && reader.lastScanStatus !== "SUCCESS" && reader.lastScanStatus !== "PRESENT")
      || reader.otaStatus === "FAILED",
    )).length,
  }), [readers]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Owner Console</p>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">Reader Management</h2>
          <p className="mt-1 text-sm text-slate-500">Monitor deployed ESP32 reader controllers, health, OTA state, and recent activity.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadReaders()}
          className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Controllers" value={stats.total} />
        <MetricCard label="Online" value={stats.online} />
        <MetricCard label="Offline" value={stats.offline} />
        <MetricCard label="OTA pending" value={stats.otaPending} />
        <MetricCard label="Errors" value={stats.errors} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr_0.9fr]">
          <input
            type="search"
            placeholder="Search reader, school, or device key"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
          <select
            value={schoolId}
            onChange={(event) => setSchoolId(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
          >
            <option value="">All schools</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>{school.name}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as (typeof STATUS_OPTIONS)[number])}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
          >
            {STATUS_OPTIONS.map((item) => (
              <option key={item} value={item}>{item.replace(/_/g, " ")}</option>
            ))}
          </select>
          <select
            value={otaStatus}
            onChange={(event) => setOtaStatus(event.target.value as (typeof OTA_OPTIONS)[number])}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
          >
            {OTA_OPTIONS.map((item) => (
              <option key={item} value={item}>{item.replace(/_/g, " ")}</option>
            ))}
          </select>
          <input
            type="search"
            placeholder="Firmware version"
            value={firmwareVersion}
            onChange={(event) => setFirmwareVersion(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Loading reader inventory...</div>
      ) : filteredReaders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">No readers match the current filters.</div>
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {filteredReaders.map((reader) => <ReaderCard key={reader.id} reader={reader} />)}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 md:block">
            <div className="max-h-[44rem] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Reader</th>
                    <th className="px-4 py-3">School</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 whitespace-nowrap">Heartbeat</th>
                    <th className="px-4 py-3 whitespace-nowrap">Firmware</th>
                    <th className="px-4 py-3 whitespace-nowrap">OTA</th>
                    <th className="px-4 py-3 whitespace-nowrap">Queue</th>
                    <th className="px-4 py-3 whitespace-nowrap">RSSI</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredReaders.map((reader) => (
                    <tr key={reader.id} className="align-top">
                      <td className="max-w-[20rem] px-4 py-3">
                        <p className="line-clamp-2 font-semibold text-slate-900">{reader.name}</p>
                        <p className="mt-0.5 font-mono text-xs text-slate-400">{reader.deviceKey}</p>
                      </td>
                      <td className="max-w-[18rem] px-4 py-3">
                        <p className="line-clamp-2 font-semibold text-slate-900">{reader.school?.name ?? "Unknown school"}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{reader.school?.code ?? reader.schoolId ?? "-"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <ReaderBadge label={reader.onlineStatus} tone={badgeClass(reader.onlineStatus)} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatDateTime(reader.lastHeartbeatAt ?? reader.lastSeenAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{reader.firmwareVersion ?? "-"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{reader.otaStatus ?? "UNKNOWN"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{reader.queueDepth}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatRssi(reader.lastRssi)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={`/owner/readers/${encodeURIComponent(reader.id)}`}
                            className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                          >
                            View
                          </Link>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                if (!window.confirm("Rotate this device token? The new token is shown once.")) return;
                                const rotated = await rotateOwnerReaderToken(reader.schoolId ?? "", reader.id);
                                window.alert(`One-time provisioning token: ${rotated.oneTimeToken}`);
                              } catch (caught) {
                                window.alert(caught instanceof Error ? caught.message : "Could not rotate token.");
                              }
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Rotate token
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function OwnerReaderDetailPage() {
  const { readerId = "" } = useParams();
  const [data, setData] = useState<OwnerReaderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadReader() {
    setLoading(true);
    setError("");
    try {
      setData(await fetchOwnerReader(readerId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load reader details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!readerId) return;
    void loadReader();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerId]);

  async function run(action: "RESTART" | "SYNC" | "UPDATE_FIRMWARE" | "RE_REGISTER") {
    try {
      if (!data?.reader.schoolId) return;
      await requestOwnerReaderAction(data.reader.schoolId, data.reader.id, action);
      setNotice(`${action.replace(/_/g, " ")} requested.`);
      await loadReader();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not request reader action.");
    }
  }

  async function rotate() {
    try {
      if (!data?.reader.schoolId) return;
      if (!window.confirm("Rotate this device token? The new provisioning token is shown once.")) return;
      const rotated = await rotateOwnerReaderToken(data.reader.schoolId, data.reader.id);
      setNotice(`One-time provisioning token generated for ${rotated.deviceKey}. Save it securely.`);
      await loadReader();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not rotate token.");
    }
  }

  const reader = data?.reader ?? null;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/owner/readers" className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700 hover:underline">
            Back to Reader Management
          </Link>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{reader?.name ?? "Reader details"}</h2>
          <p className="mt-1 text-sm text-slate-500">{reader?.school?.name ?? "Loading school..."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void loadReader()} className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
            Refresh
          </button>
          <button type="button" onClick={() => void rotate()} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
            Rotate token
          </button>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">{notice}</div> : null}

      {loading || !data || !reader ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Loading reader details...</div>
      ) : (
        <div className="grid gap-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <ReaderBadge label={reader.onlineStatus} tone={badgeClass(reader.onlineStatus)} />
                <p className="mt-2 font-mono text-xs text-slate-400">{reader.deviceKey}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void run("RESTART")} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">Restart</button>
                <button type="button" onClick={() => void run("SYNC")} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">Sync</button>
                <button type="button" onClick={() => void run("UPDATE_FIRMWARE")} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">Update firmware</button>
                <button type="button" onClick={() => void run("RE_REGISTER")} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">Re-register</button>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Metric label="School" value={reader.school?.name ?? "Unknown"} />
              <Metric label="Last heartbeat" value={formatDateTime(reader.lastHeartbeatAt ?? reader.lastSeenAt)} />
              <Metric label="Last seen" value={formatDateTime(reader.lastSeenAt)} />
              <Metric label="Firmware" value={reader.firmwareVersion ?? "-"} />
              <Metric label="OTA status" value={reader.otaStatus ?? "UNKNOWN"} />
              <Metric label="Queue / RSSI" value={`${reader.queueDepth} / ${formatRssi(reader.lastRssi)}`} />
              <Metric label="Uptime" value={reader.uptimeMs == null ? "-" : `${Math.round(reader.uptimeMs / 1000).toLocaleString("en-UG")}s`} />
              <Metric label="Memory" value={formatMemory(reader.freeHeap)} />
              <Metric label="Reboot reason" value={reader.rebootReason ?? "-"} />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Metric label="Location" value={reader.locationName ?? reader.location ?? "-"} />
              <Metric label="Last IP" value={reader.lastIp ?? "-"} />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <TimelineSection title="Recent scans" items={data.diagnostics.recentScans} />
            <TimelineSection title="Recent errors" items={data.diagnostics.recentErrors} />
            <TimelineSection title="OTA history" items={data.diagnostics.otaHistory} />
            <TimelineSection title="Heartbeat history" items={data.diagnostics.heartbeats} />
          </section>
        </div>
      )}
    </div>
  );
}

function TimelineSection({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; action: string; correlationId: string | null; details: unknown; createdAt: string }>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-black text-slate-950">{title}</h3>
      <div className="mt-3 grid gap-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No entries yet.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-xl bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold text-slate-900">{item.action.replace(/_/g, " ")}</p>
                <p className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</p>
              </div>
              <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-600">{JSON.stringify(item.details, null, 2)}</pre>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
    </div>
  );
}
