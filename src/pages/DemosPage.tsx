import { buildWhatsAppUrl } from "../config/contact";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I'd like to book a product demo for my organisation.",
);

// ── Icon helpers ──────────────────────────────────────────────────────────────

function Icon({ children, className = "w-6 h-6" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}
function ReportIcon({ className }: { className?: string }) {
  return <Icon className={className}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></Icon>;
}
function PagesIcon({ className }: { className?: string }) {
  return <Icon className={className}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></Icon>;
}
function SchoolIcon({ className }: { className?: string }) {
  return <Icon className={className}><path d="M3 10 12 4l9 6-9 6-9-6Z" /><path d="M6 11v6c0 1.1 2.7 2 6 2s6-.9 6-2v-6" /></Icon>;
}
function ScaleIcon({ className }: { className?: string }) {
  return <Icon className={className}><path d="M12 3v18" /><path d="M5 7 2 17h6M19 7l3 10h-6" /><path d="M5 21h14" /></Icon>;
}
function WalletIcon({ className }: { className?: string }) {
  return <Icon className={className}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M16 13a1 1 0 1 0 2 0 1 1 0 0 0-2 0Z" /><path d="M2 10h20" /></Icon>;
}
function WristbandIcon({ className }: { className?: string }) {
  return <Icon className={className}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></Icon>;
}
function PlayIcon({ className }: { className?: string }) {
  return <Icon className={className}><path d="m9 7 8 5-8 5V7Z" /></Icon>;
}
function ArrowRightIcon({ className }: { className?: string }) {
  return <Icon className={className}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
}
function ExternalLinkIcon({ className }: { className?: string }) {
  return <Icon className={className}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="m10 14 11-11" /></Icon>;
}

// ── Demo data ─────────────────────────────────────────────────────────────────

type DemoStatus = "available" | "soon" | "preview";

interface Demo {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: React.ReactNode;
  status: DemoStatus;
  demoHref?: string;   // Only set when a real demo page exists
  tags: string[];
}

const DEMOS: Demo[] = [
  {
    id: "report-lab",
    name: "School Connect Report Lab",
    tagline: "Student reports made digital and professional.",
    description:
      "See how schools enter marks, generate professional student report cards, review results, approve reports, and share them securely with parents — all from one dashboard.",
    icon: <ReportIcon className="w-7 h-7" />,
    status: "preview",
    tags: ["Schools", "Reports", "Parents"],
  },
  {
    id: "smart-pages",
    name: "Smart Pages",
    tagline: "Turn documents into organized digital pages.",
    description:
      "Watch how institutions upload raw documents — handbooks, policies, letters, forms — and turn them into clean, editable, shareable digital pages that teams can collaborate on.",
    icon: <PagesIcon className="w-7 h-7" />,
    status: "available",
    demoHref: "/features-demo",
    tags: ["Schools", "Offices", "Documents", "Live"],
  },
  {
    id: "legal-smart-pages",
    name: "Legal Smart Pages",
    tagline: "Smart documents for legal teams.",
    description:
      "Smart document workflows built specifically for lawyers and legal teams — cleaning, drafting, organizing, and preparing legal documents without the chaos of scattered files.",
    icon: <ScaleIcon className="w-7 h-7" />,
    status: "soon",
    tags: ["Legal Teams", "Law Firms", "Documents"],
  },
  {
    id: "school-connect-ops",
    name: "School Connect Operations",
    tagline: "The full school operations platform.",
    description:
      "Manage student records, attendance, digital IDs, school notices, wallets, and workflows in one connected platform — built for school administrators and leadership teams.",
    icon: <SchoolIcon className="w-7 h-7" />,
    status: "preview",
    tags: ["Schools", "Administration", "Operations"],
  },
  {
    id: "kids-wallet",
    name: "Kids Wallet",
    tagline: "Controlled school spending for students.",
    description:
      "A simple, safe wallet system that gives parents control over their child's school spending — linked to canteen, school fees, and activities via digital ID or wristband.",
    icon: <WalletIcon className="w-7 h-7" />,
    status: "soon",
    tags: ["Schools", "Parents", "Payments"],
  },
  {
    id: "nfc-wristbands",
    name: "NFC Wristbands",
    tagline: "Smart access and identification for schools.",
    description:
      "Smart wristbands that identify students at gates, record attendance, control canteen access, and link to wallets — building a safe, tracked, and efficient school environment.",
    icon: <WristbandIcon className="w-7 h-7" />,
    status: "soon",
    tags: ["Schools", "Attendance", "Safety", "NFC"],
  },
];

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DemoStatus, { label: string; badgeBg: string; badgeColor: string; dot: string }> = {
  available: { label: "Demo Available", badgeBg: "#DCFCE7", badgeColor: "#16A34A", dot: "#22C55E" },
  preview:   { label: "Preview Coming Soon", badgeBg: "#FEF3C7", badgeColor: "#B45309", dot: "#F59E0B" },
  soon:      { label: "Coming Soon", badgeBg: "#F1F5F9", badgeColor: "#64748B", dot: "#CBD5E1" },
};

// ── Demo card ─────────────────────────────────────────────────────────────────

function DemoCard({ demo }: { demo: Demo }) {
  const s = STATUS_CONFIG[demo.status];
  const isAvailable = demo.status === "available";

  return (
    <article
      className="flex flex-col rounded-2xl border overflow-hidden transition-all hover:-translate-y-1 marketing-card-motion"
      style={{
        background: "white",
        borderColor: "#D8E2F0",
        boxShadow: "0 2px 12px rgba(11,47,107,0.07)",
      }}
    >
      {/* Card top accent bar */}
      <div
        className="h-1.5 w-full"
        style={{ background: isAvailable ? "linear-gradient(90deg, #0F5BD8, #10B981)" : "linear-gradient(90deg, #D8E2F0, #EAF3FF)" }}
      />

      <div className="flex flex-col flex-1 p-6">
        {/* Icon + status */}
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: isAvailable ? "#EAF3FF" : "#F8FAFF",
              color: isAvailable ? "#0F5BD8" : "#94A3B8",
            }}
          >
            {demo.icon}
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: s.badgeBg, color: s.badgeColor }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
            {s.label}
          </span>
        </div>

        {/* Text */}
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#0F5BD8" }}>
          {demo.tagline}
        </p>
        <h2 className="text-[17px] font-bold leading-snug mb-3" style={{ color: "#111827" }}>
          {demo.name}
        </h2>
        <p className="text-sm leading-relaxed flex-1" style={{ color: "#4B5563" }}>
          {demo.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {demo.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-[11px] font-medium rounded-full"
              style={{ background: "#EAF3FF", color: "#0F5BD8" }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-5 pt-5 border-t flex items-center gap-3" style={{ borderColor: "#EAF3FF" }}>
          {isAvailable && demo.demoHref ? (
            <a
              href={demo.demoHref}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl text-white transition-all hover:opacity-90 active:scale-95 shadow-sm"
              style={{ background: "#0F5BD8" }}
            >
              <PlayIcon className="w-4 h-4" />
              Open Demo
              <ExternalLinkIcon className="w-3.5 h-3.5 opacity-70" />
            </a>
          ) : (
            <span
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl cursor-default"
              style={{ background: "#F1F5F9", color: "#9CA3AF" }}
            >
              {demo.status === "preview" ? "Preview Coming Soon" : "Coming Soon"}
            </span>
          )}
          <a
            href={BOOK_DEMO_URL}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold transition-colors hover:opacity-70"
            style={{ color: "#0F5BD8" }}
          >
            Book guided demo →
          </a>
        </div>
      </div>
    </article>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function DemosPage() {
  const availableCount = DEMOS.filter((d) => d.status === "available").length;
  const comingSoonCount = DEMOS.filter((d) => d.status !== "available").length;

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      {/* ── Hero ── */}
      <section
        className="relative pt-24 pb-14 lg:pt-32 lg:pb-20 overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0B2F6B 0%, #0F5BD8 60%, #1A72F0 100%)" }}
      >
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
            style={{ background: "rgba(255,255,255,0.12)", color: "#BFDBFE", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            {availableCount} demos available now
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight">
            Explore SSAMENJ
            <br />
            <span style={{ color: "#93C5FD" }}>Product Demos</span>
          </h1>
          <p className="mt-5 text-base max-w-2xl mx-auto leading-relaxed" style={{ color: "#BFDBFE" }}>
            See our digital systems in action. Try the live demos, preview upcoming products, or book a guided walkthrough with our team.
          </p>

          {/* Stats row */}
          <div className="mt-8 inline-flex items-center gap-6 px-6 py-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <div className="text-center">
              <div className="text-2xl font-black text-white">{availableCount}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "#93C5FD" }}>Live Demos</div>
            </div>
            <div className="w-px h-10" style={{ background: "rgba(255,255,255,0.15)" }} />
            <div className="text-center">
              <div className="text-2xl font-black text-white">{comingSoonCount}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "#93C5FD" }}>In Pipeline</div>
            </div>
            <div className="w-px h-10" style={{ background: "rgba(255,255,255,0.15)" }} />
            <div className="text-center">
              <div className="text-2xl font-black text-white">Free</div>
              <div className="text-[11px] mt-0.5" style={{ color: "#93C5FD" }}>No account needed</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live demos ── */}
      <section className="py-14 lg:py-20" style={{ background: "white" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-extrabold" style={{ color: "#111827" }}>
                Available Now
              </h2>
              <p className="mt-1 text-sm" style={{ color: "#6B7280" }}>
                Try these demos directly in your browser — no account needed.
              </p>
            </div>
            <span
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: "#DCFCE7", color: "#16A34A" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {availableCount} Live
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {DEMOS.filter((d) => d.status === "available").map((demo) => (
              <DemoCard key={demo.id} demo={demo} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-t" style={{ borderColor: "#EAF3FF" }} />
      </div>

      {/* ── Coming soon ── */}
      <section className="py-14 lg:py-20" style={{ background: "white" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-extrabold" style={{ color: "#111827" }}>
                Coming Soon
              </h2>
              <p className="mt-1 text-sm" style={{ color: "#6B7280" }}>
                These products are being built. Book a demo to preview them early and help us tailor them to your real institutional needs.
              </p>
            </div>
            <span
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: "#F1F5F9", color: "#64748B" }}
            >
              {comingSoonCount} in pipeline
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {DEMOS.filter((d) => d.status !== "available").map((demo) => (
              <DemoCard key={demo.id} demo={demo} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Book a demo CTA ── */}
      <section className="py-14 lg:py-20" style={{ background: "#EAF3FF" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3" style={{ color: "#111827" }}>
            Want a personalised walkthrough?
          </h2>
          <p className="text-base mb-8 leading-relaxed" style={{ color: "#4B5563" }}>
            Our team will walk you through the right SSAMENJ product for your school, office, or organisation — at your pace, tailored to your workflow.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href={BOOK_DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl text-white shadow-md transition-all hover:opacity-90 hover:-translate-y-px"
              style={{ background: "#0B2F6B" }}
            >
              Book a Guided Demo
              <ArrowRightIcon className="w-4 h-4" />
            </a>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl border transition-all hover:bg-white"
              style={{ color: "#0B2F6B", borderColor: "#D8E2F0", background: "white" }}
            >
              Contact Our Team
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}
