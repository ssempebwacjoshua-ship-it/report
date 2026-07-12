import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createCommunicationCampaign, fetchCommunicationCampaigns, type CommunicationCampaign } from "../client/communicationsClient";

const campaignTypes = ["ANNOUNCEMENT", "CIRCULAR", "REPORT_RELEASE", "EVENT", "EMERGENCY_ALERT", "FEE_NOTICE", "ATTENDANCE_ALERT", "RECEIPT", "VIDEO_MESSAGE", "CUSTOM"];

export function CommunicationsPage() {
  const [campaigns, setCampaigns] = useState<CommunicationCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"Campaigns" | "Delivery">("Campaigns");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ type: "ANNOUNCEMENT", title: "", subject: "", body: "" });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCommunicationCampaigns();
      setCampaigns(data.campaigns);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load communication campaigns");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => ({
    drafts: campaigns.filter((c) => c.status === "DRAFT").length,
    approval: campaigns.filter((c) => c.status.includes("APPROVAL") || c.status === "READY_FOR_APPROVAL").length,
    scheduled: campaigns.filter((c) => c.status === "SCHEDULED").length,
    sending: campaigns.filter((c) => c.status === "QUEUED" || c.status === "SENDING").length,
    failed: campaigns.filter((c) => c.status === "FAILED" || c.status === "VALIDATION_FAILED").length,
  }), [campaigns]);

  async function submitCampaign(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await createCommunicationCampaign(form);
      setForm({ type: "ANNOUNCEMENT", title: "", subject: "", body: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create communication campaign");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 md:px-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Communication Center</p>
          <h1 className="text-2xl font-black text-slate-950">Communication</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Campaigns, audiences, approvals and delivery operations for SMS and WhatsApp. Provider sending is dry-run by default.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black uppercase text-amber-800">
          DRY RUN
        </span>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Drafts" value={counts.drafts} />
        <Metric label="Approval" value={counts.approval} />
        <Metric label="Scheduled" value={counts.scheduled} />
        <Metric label="Sending" value={counts.sending} />
        <Metric label="Failed" value={counts.failed} />
      </section>

      <div className="flex gap-2 border-b border-slate-200">
        {(["Campaigns", "Delivery"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={`border-b-2 px-3 py-2 text-sm font-bold ${tab === item ? "border-blue-500 text-blue-700" : "border-transparent text-slate-500"}`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Campaigns" ? (
        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <form onSubmit={submitCampaign} className="premium-card grid gap-3 rounded-2xl p-4">
            <h2 className="text-sm font-black text-slate-900">Create Communication</h2>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Type
              <select className="premium-control rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={form.type} onChange={(event) => setForm((f) => ({ ...f, type: event.target.value }))}>
                {campaignTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Title
              <input className="premium-control rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={form.title} onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))} />
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Subject
              <input className="premium-control rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={form.subject} onChange={(event) => setForm((f) => ({ ...f, subject: event.target.value }))} />
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Body
              <textarea className="premium-control min-h-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={form.body} onChange={(event) => setForm((f) => ({ ...f, body: event.target.value }))} />
            </label>
            <button type="submit" className="btn btn-primary" disabled={creating || !form.title.trim() || !form.body.trim()}>
              {creating ? "Creating..." : "Create draft"}
            </button>
          </form>

          <CampaignList loading={loading} campaigns={campaigns} />
        </div>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Delivery operations will show queued dry-run deliveries, provider attempts, fallback status and acknowledgements as campaigns are validated and queued.
        </section>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function CampaignList({ loading, campaigns }: { loading: boolean; campaigns: CommunicationCampaign[] }) {
  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading...</div>;
  if (campaigns.length === 0) return <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">No communication campaigns yet.</div>;
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {campaigns.map((campaign) => (
        <article key={campaign.id} className="flex flex-col gap-2 border-b border-slate-100 p-4 last:border-0 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-black text-slate-900">{campaign.title}</h2>
            <p className="text-sm text-slate-600">{campaign.type.replaceAll("_", " ")} · {campaign._count?.recipients ?? 0} recipients · {campaign._count?.deliveries ?? 0} deliveries</p>
            <p className="mt-1 line-clamp-1 text-xs text-slate-500">{campaign.contents?.[0]?.body}</p>
          </div>
          <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase text-slate-700">{campaign.status.replaceAll("_", " ")}</span>
        </article>
      ))}
    </section>
  );
}
