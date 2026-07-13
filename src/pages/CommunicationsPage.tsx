import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  createCommunicationCampaign,
  fetchCommunicationCampaigns,
  previewCommunicationRecipients,
  sendCommunication,
  type CommunicationCampaign,
  type CommunicationPreview,
} from "../client/communicationsClient";

const campaignTypes = ["ANNOUNCEMENT", "CIRCULAR", "REPORT_RELEASE", "EVENT", "EMERGENCY_ALERT", "FEE_NOTICE", "ATTENDANCE_ALERT", "RECEIPT", "VIDEO_MESSAGE", "CUSTOM"];

export function CommunicationsPage() {
  const [campaigns, setCampaigns] = useState<CommunicationCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"Campaigns" | "Delivery">("Campaigns");
  const [creating, setCreating] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<"WHATSAPP" | "SMS">("WHATSAPP");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [preview, setPreview] = useState<CommunicationPreview | null>(null);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "ANNOUNCEMENT", title: "", subject: "", body: "" });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCommunicationCampaigns();
      setCampaigns(data.campaigns);
      setSelectedCampaignId((current) => current || data.campaigns[0]?.id || "");
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
      const data = await fetchCommunicationCampaigns();
      setCampaigns(data.campaigns);
      setSelectedCampaignId(data.campaigns[0]?.id ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create communication campaign");
    } finally {
      setCreating(false);
    }
  }

  async function handlePreview(campaignId: string) {
    setSelectedCampaignId(campaignId);
    setPreview(null);
    setSendResult(null);
    setError(null);
    try {
      const data = await previewCommunicationRecipients(campaignId, { mode: "GENERAL" });
      setPreview(data.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not preview recipients");
    }
  }

  async function handleSend(campaignId: string) {
    if (!preview || preview.ready === 0) {
      setError("Preview recipients before sending.");
      return;
    }
    const confirmed = window.confirm(`Send ${selectedChannel} message to ${preview.ready} recipients?`);
    if (!confirmed) return;
    setSendingId(campaignId);
    setError(null);
    setSendResult(null);
    try {
      const result = await sendCommunication(campaignId, {
        channel: selectedChannel,
        confirm: true,
        audience: { mode: "GENERAL" },
      });
      setSendResult(`Submitted ${result.result.submitted}; failed ${result.result.failed}; duplicates skipped ${result.result.skippedDuplicate}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${selectedChannel === "WHATSAPP" ? "WhatsApp" : "SMS"} is not configured yet. Contact platform owner.`);
    } finally {
      setSendingId(null);
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
      {sendResult ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{sendResult}</div> : null}

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

          <CampaignList
            loading={loading}
            campaigns={campaigns}
            selectedChannel={selectedChannel}
            selectedCampaignId={selectedCampaignId}
            preview={preview}
            sendingId={sendingId}
            onChannelChange={setSelectedChannel}
            onPreview={handlePreview}
            onSend={handleSend}
          />
        </div>
      ) : (
        <DeliverySummary campaigns={campaigns} />
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

function CampaignList({
  loading,
  campaigns,
  selectedChannel,
  selectedCampaignId,
  preview,
  sendingId,
  onChannelChange,
  onPreview,
  onSend,
}: {
  loading: boolean;
  campaigns: CommunicationCampaign[];
  selectedChannel: "WHATSAPP" | "SMS";
  selectedCampaignId: string;
  preview: CommunicationPreview | null;
  sendingId: string | null;
  onChannelChange: (channel: "WHATSAPP" | "SMS") => void;
  onPreview: (campaignId: string) => Promise<void>;
  onSend: (campaignId: string) => Promise<void>;
}) {
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
            {selectedCampaignId === campaign.id && preview ? (
              <p className="mt-2 text-xs font-semibold text-slate-700">
                Preview: {preview.ready} ready · {preview.blocked} blocked
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="premium-control h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
              value={selectedChannel}
              onChange={(event) => onChannelChange(event.target.value as "WHATSAPP" | "SMS")}
            >
              <option value="WHATSAPP">WhatsApp</option>
              <option value="SMS">SMS</option>
            </select>
            <button type="button" className="btn btn-secondary" onClick={() => void onPreview(campaign.id)}>
              Preview
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void onSend(campaign.id)}
              disabled={sendingId === campaign.id || selectedCampaignId !== campaign.id || !preview || preview.ready === 0}
            >
              {sendingId === campaign.id ? "Sending..." : "Confirm send"}
            </button>
            <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase text-slate-700">{campaign.status.replaceAll("_", " ")}</span>
          </div>
        </article>
      ))}
    </section>
  );
}

function DeliverySummary({ campaigns }: { campaigns: CommunicationCampaign[] }) {
  const totals = campaigns.reduce((sum, campaign) => sum + (campaign._count?.deliveries ?? 0), 0);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
      <p className="font-bold text-slate-900">Delivery status</p>
      <p className="mt-1">{totals} delivery records created across current campaigns. Open a campaign row to preview and send SMS or WhatsApp.</p>
    </section>
  );
}
