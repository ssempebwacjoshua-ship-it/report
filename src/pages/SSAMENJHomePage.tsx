import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { buildWhatsAppUrl } from "../config/contact";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I'd like to book a product demo for my organisation.",
);

// ── Icon system ───────────────────────────────────────────────────────────────

function Ico({ children, className = "w-5 h-5" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}
const ReportIco   = ({ c = "w-5 h-5" }: { c?: string }) => <Ico className={c}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></Ico>;
const PagesIco    = ({ c = "w-5 h-5" }: { c?: string }) => <Ico className={c}><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></Ico>;
const SchoolIco   = ({ c = "w-5 h-5" }: { c?: string }) => <Ico className={c}><path d="M3 10 12 4l9 6-9 6-9-6Z"/><path d="M6 11v6c0 1.1 2.7 2 6 2s6-.9 6-2v-6"/><path d="M12 10v9"/></Ico>;
const ScaleIco    = ({ c = "w-5 h-5" }: { c?: string }) => <Ico className={c}><path d="M12 3v18M5 7 2 17h6M19 7l3 10h-6M5 21h14"/></Ico>;
const WalletIco   = ({ c = "w-5 h-5" }: { c?: string }) => <Ico className={c}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 13a1 1 0 1 0 2 0 1 1 0 0 0-2 0ZM2 10h20"/></Ico>;
const WristbandIco= ({ c = "w-5 h-5" }: { c?: string }) => <Ico className={c}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></Ico>;
const GearIco     = ({ c = "w-5 h-5" }: { c?: string }) => <Ico className={c}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></Ico>;
const CheckIco    = ({ c = "w-4 h-4" }: { c?: string }) => <Ico className={c}><path d="m5 12 4 4 10-10"/></Ico>;
const ArrowIco    = ({ c = "w-4 h-4" }: { c?: string }) => <Ico className={c}><path d="M5 12h14M13 6l6 6-6 6"/></Ico>;
const PlayIco     = ({ c = "w-4 h-4" }: { c?: string }) => <Ico className={c}><path d="m9 7 8 5-8 5V7Z"/></Ico>;

// ── Hero dashboard visual ─────────────────────────────────────────────────────

const DASHBOARD_PRODUCTS = [
  { id: "rl", label: "RL", name: "Report Lab",        icon: <ReportIco    c="w-4 h-4" />, status: "live" as const },
  { id: "sp", label: "SP", name: "Smart Pages",       icon: <PagesIco     c="w-4 h-4" />, status: "live" as const },
  { id: "sc", label: "SC", name: "School Connect",    icon: <SchoolIco    c="w-4 h-4" />, status: "live" as const },
  { id: "ls", label: "LS", name: "Legal Smart Pages", icon: <ScaleIco     c="w-4 h-4" />, status: "demo" as const },
  { id: "kw", label: "KW", name: "Kids Wallet",       icon: <WalletIco    c="w-4 h-4" />, status: "soon" as const },
  { id: "nf", label: "NF", name: "NFC Wristbands",    icon: <WristbandIco c="w-4 h-4" />, status: "soon" as const },
  { id: "cd", label: "CD", name: "Custom Digital",    icon: <GearIco      c="w-4 h-4" />, status: "live" as const },
];

const STATUS_DOT: Record<string, { dot: string; label: string; labelColor: string }> = {
  live: { dot: "#22C55E", label: "Live",           labelColor: "#16A34A" },
  demo: { dot: "#3B82F6", label: "Demo Available", labelColor: "#1D4ED8" },
  soon: { dot: "#94A3B8", label: "Coming Soon",    labelColor: "#64748B" },
};

function HeroDashboard() {
  return (
    /* Outer bordered card */
    <div
      className="relative w-full rounded-2xl overflow-hidden"
      style={{
        border: "2px solid #0F5BD8",
        boxShadow: "0 0 0 6px rgba(15,91,216,0.08), 0 24px 80px rgba(15,91,216,0.14), 0 8px 32px rgba(11,47,107,0.1)",
      }}
    >
      {/* Inner gradient background */}
      <div
        className="w-full"
        style={{
          background: "linear-gradient(145deg, #EAF3FF 0%, #F5F9FF 35%, #FFFFFF 65%, #F8FBFF 100%)",
        }}
      >
        {/* Browser chrome */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ background: "rgba(255,255,255,0.85)", borderColor: "#D8E2F0" }}
        >
          <div className="flex gap-1.5 flex-shrink-0">
            <div className="w-3 h-3 rounded-full" style={{ background: "#FCA5A5" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#FCD34D" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#6EE7B7" }} />
          </div>
          <div
            className="flex items-center gap-2 flex-1 max-w-xs px-3 py-1.5 rounded-lg text-[11px] font-medium"
            style={{ background: "#EAF3FF", color: "#0F5BD8" }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
            app.ssamenj.com
          </div>
        </div>

        {/* App top bar */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ background: "white", borderColor: "#EAF3FF" }}
        >
          <div className="flex items-center gap-3">
            <img src="/ssamenj-logo.png" alt="" className="w-6 h-6 object-contain" />
            <div>
              <span className="text-[12px] font-extrabold" style={{ color: "#0B2F6B" }}>SSAMENJ</span>
              <span className="ml-1 text-[12px] font-semibold" style={{ color: "#6B7280" }}>Suite</span>
            </div>
            <div
              className="hidden sm:flex items-center gap-1 ml-3 px-2 py-1 rounded-full text-[10px] font-semibold"
              style={{ background: "#EAF3FF", color: "#0F5BD8" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              3 Live
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 text-[11px]" style={{ color: "#94A3B8" }}>
              <span>7 Products</span>
            </div>
            <div
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold"
              style={{ background: "#0F5BD8", color: "white" }}
            >
              Explore Suite
            </div>
          </div>
        </div>

        {/* Product grid */}
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {DASHBOARD_PRODUCTS.map((p) => {
              const s = STATUS_DOT[p.status];
              const isLive = p.status === "live";
              const isDemo = p.status === "demo";
              return (
                <div
                  key={p.id}
                  className="rounded-xl p-3.5 border flex flex-col gap-2.5 transition-all hover:shadow-sm"
                  style={{
                    background: "white",
                    borderColor: "#EAF3FF",
                    boxShadow: "0 1px 4px rgba(11,47,107,0.06)",
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        background: isLive ? "#EAF3FF" : isDemo ? "#DBEAFE" : "#F1F5F9",
                        color: isLive ? "#0F5BD8" : isDemo ? "#2563EB" : "#94A3B8",
                      }}
                    >
                      {p.icon}
                    </div>
                    <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: s.dot }} />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold leading-snug" style={{ color: "#111827" }}>
                      {p.name}
                    </div>
                    <div className="mt-1 text-[10px] font-semibold" style={{ color: s.labelColor }}>
                      {s.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom bar */}
          <div
            className="mt-4 flex items-center justify-between px-3 py-2.5 rounded-xl border"
            style={{ background: "#F8FBFF", borderColor: "#EAF3FF" }}
          >
            <div className="flex items-center gap-4">
              {[
                { color: "#22C55E", label: "3 Live" },
                { color: "#3B82F6", label: "1 Demo" },
                { color: "#94A3B8", label: "3 Coming Soon" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                  <span className="text-[10px] font-medium hidden sm:inline" style={{ color: "#6B7280" }}>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px] font-semibold" style={{ color: "#0F5BD8" }}>
              SSAMENJ Technologies
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Product cards ─────────────────────────────────────────────────────────────

type PStatus = "live" | "demo" | "development" | "soon";

interface Product {
  name: string;
  tagline: string;
  icon: React.ReactNode;
  status: PStatus;
  href: string;
  ctaLabel: string;
}

const PRODUCTS: Product[] = [
  { name: "School Connect Report Lab",  tagline: "Generate, review, and share professional student reports from marksheets.", icon: <ReportIco c="w-5 h-5"/>,    status: "live",        href: "/demos",   ctaLabel: "View Demo"  },
  { name: "Smart Pages",               tagline: "Turn raw documents into clean, editable, shareable digital pages.",         icon: <PagesIco c="w-5 h-5"/>,    status: "live",        href: "/demos",   ctaLabel: "View Demo"  },
  { name: "Legal Smart Pages",         tagline: "Smart document workflows for lawyers and legal teams.",                     icon: <ScaleIco c="w-5 h-5"/>,    status: "demo",        href: "/demos",   ctaLabel: "Explore"    },
  { name: "School Connect Operations", tagline: "Student records, attendance, IDs, notices, and workflows in one platform.", icon: <SchoolIco c="w-5 h-5"/>,   status: "development", href: "/products",ctaLabel: "Learn More" },
  { name: "Kids Wallet",               tagline: "Controlled school spending linked to digital ID or NFC wristband.",         icon: <WalletIco c="w-5 h-5"/>,   status: "soon",        href: "/products",ctaLabel: "Coming Soon"},
  { name: "NFC Wristbands",            tagline: "Smart student identification for gates, canteen, and attendance.",          icon: <WristbandIco c="w-5 h-5"/>,status: "soon",        href: "/products",ctaLabel: "Coming Soon"},
  { name: "Custom Digital Products",   tagline: "Purpose-built systems for organisations with unique workflows.",            icon: <GearIco c="w-5 h-5"/>,     status: "live",        href: "/contact", ctaLabel: "Get in Touch"},
];

const SBADGE: Record<PStatus, { label: string; bg: string; color: string; dot: string }> = {
  live:        { label: "Live",           bg: "#DCFCE7", color: "#16A34A", dot: "#22C55E" },
  demo:        { label: "Demo Available", bg: "#DBEAFE", color: "#1D4ED8", dot: "#3B82F6" },
  development: { label: "In Development", bg: "#FEF3C7", color: "#B45309", dot: "#F59E0B" },
  soon:        { label: "Coming Soon",    bg: "#F1F5F9", color: "#64748B", dot: "#CBD5E1" },
};

function StatusBadge({ s }: { s: PStatus }) {
  const m = SBADGE[s];
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: m.bg, color: m.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

function ProductCard({ p }: { p: Product }) {
  const isSoon = p.status === "soon";
  return (
    <div
      className="group relative flex flex-col rounded-2xl border p-6 transition-all hover:-translate-y-1 hover:shadow-lg"
      style={{ background: "white", borderColor: "#E5EBF5", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(11,47,107,0.05)" }}
    >
      {/* Hover accent top line */}
      <div className="absolute top-0 inset-x-0 h-0.5 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "linear-gradient(90deg, #0F5BD8, #60A5FA)" }} />

      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#EAF3FF", color: "#0F5BD8" }}>
          {p.icon}
        </div>
        <StatusBadge s={p.status} />
      </div>

      <h3 className="text-[15px] font-bold leading-snug mb-2" style={{ color: "#0B2F6B" }}>{p.name}</h3>
      <p className="text-sm leading-relaxed flex-1" style={{ color: "#4B5563" }}>{p.tagline}</p>

      <div className="mt-5 pt-4 border-t" style={{ borderColor: "#F1F5F9" }}>
        {isSoon ? (
          <span className="text-sm font-medium" style={{ color: "#94A3B8" }}>Coming Soon</span>
        ) : (
          <a
            href={p.href}
            className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors hover:opacity-70"
            style={{ color: "#0F5BD8" }}
          >
            {p.ctaLabel} <ArrowIco c="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

// ── Why section data ──────────────────────────────────────────────────────────

const WHY_POINTS = [
  { title: "Simple for everyday users",      body: "Designed for teachers, clerks, and front-line staff — not IT departments." },
  { title: "Secure and institution-ready",   body: "Each institution's data is isolated, protected, and auditable." },
  { title: "Practical workflows by default", body: "No bloated features. Every product is built around real workflows." },
  { title: "Built for African institutions", body: "We understand local operational realities and build to global standards." },
  { title: "Grows with your institution",    body: "From a single school to a multi-campus network — our systems scale." },
];

const HOW_STEPS = [
  { n: "01", title: "Understand your workflow",     body: "We map how your team actually works before proposing anything." },
  { n: "02", title: "Configure the right solution", body: "We set up the system specifically for your institution's needs." },
  { n: "03", title: "Your team starts working faster", body: "Staff get training and support until the system feels natural." },
  { n: "04", title: "Manage, track, and grow",      body: "Dashboards and reports keep you in control as you scale." },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export function SSAMENJHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  useEffect(() => { if (user) navigate("/dashboard"); }, [user, navigate]);

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="relative pt-24 pb-0 overflow-hidden"
        style={{ background: "white" }}
      >
        {/* Subtle top radial glow */}
        <div
          className="absolute inset-x-0 top-0 h-80 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(15,91,216,0.07) 0%, transparent 70%)" }}
        />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <span
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-widest uppercase border"
              style={{ background: "#EAF3FF", color: "#0F5BD8", borderColor: "#D8E2F0" }}
            >
              <img src="/ssamenj-logo.png" alt="" className="w-3.5 h-3.5 object-contain" />
              SSAMENJ Technologies
            </span>
          </div>

          {/* Headline */}
          <h1
            className="text-4xl sm:text-5xl lg:text-[60px] font-extrabold leading-tight tracking-tight"
            style={{ color: "#0B2F6B", letterSpacing: "-0.02em" }}
          >
            Smart systems for schools,
            <br className="hidden sm:block" />
            <span style={{ color: "#0F5BD8" }}> offices, and growing businesses.</span>
          </h1>

          {/* Subheadline */}
          <p
            className="mt-5 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto"
            style={{ color: "#4B5563" }}
          >
            SSAMENJ Technologies builds practical digital tools that reduce paperwork, organise work, and help institutions serve people faster.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={BOOK_DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white shadow-md transition-all hover:opacity-90 hover:-translate-y-px active:scale-95"
              style={{ background: "#0F5BD8" }}
            >
              Book Demo
              <ArrowIco c="w-4 h-4" />
            </a>
            <a
              href="/products"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold border transition-all hover:bg-[#EAF3FF] hover:-translate-y-px"
              style={{ color: "#0B2F6B", borderColor: "#D8E2F0", background: "white" }}
            >
              View Products
              <ArrowIco c="w-4 h-4" />
            </a>
          </div>

          {/* Trust line */}
          <p className="mt-4 text-xs" style={{ color: "#9CA3AF" }}>
            Used by schools and institutions · No credit card required
          </p>
        </div>

        {/* Hero dashboard card — slightly overlapping into next section */}
        <div className="relative mt-12 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <HeroDashboard />
          {/* Fade-out gradient at bottom of hero */}
          <div
            className="absolute inset-x-4 bottom-0 h-16 pointer-events-none rounded-b-2xl"
            style={{ background: "linear-gradient(to top, white, transparent)" }}
          />
        </div>
      </section>

      {/* ── Thin divider with label ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px" style={{ background: "#E5EBF5" }} />
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#94A3B8" }}>
            Our Products
          </span>
          <div className="flex-1 h-px" style={{ background: "#E5EBF5" }} />
        </div>
      </div>

      {/* ── Products grid ── */}
      <section className="pb-16 lg:pb-24" style={{ background: "white" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold" style={{ color: "#0B2F6B" }}>
              Digital products built for real institutions
            </h2>
            <p className="mt-3 text-sm max-w-lg mx-auto" style={{ color: "#4B5563" }}>
              Every product is born from a real institution challenge — designed to fit how your team actually works.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {PRODUCTS.map((p) => <ProductCard key={p.name} p={p} />)}
          </div>

          <div className="mt-8 text-center">
            <a
              href="/products"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all hover:bg-[#EAF3FF]"
              style={{ color: "#0B2F6B", borderColor: "#D8E2F0" }}
            >
              See all product details
              <ArrowIco c="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Live demos banner ── */}
      <section className="py-14 lg:py-16" style={{ background: "#EAF3FF" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
                style={{ background: "white", color: "#0F5BD8", border: "1px solid #D8E2F0" }}
              >
                <PlayIco c="w-3 h-3" />
                Live Demos Available
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold mb-3" style={{ color: "#0B2F6B" }}>
                See our products in action.
              </h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "#4B5563" }}>
                Try live demos before committing. Report Lab and Smart Pages are available now. More demos are on the way.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/demos"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: "#0F5BD8" }}
                >
                  View All Demos
                  <ArrowIco c="w-4 h-4" />
                </a>
                <a
                  href={BOOK_DEMO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all hover:bg-white"
                  style={{ color: "#0B2F6B", borderColor: "#D8E2F0", background: "rgba(255,255,255,0.7)" }}
                >
                  Book Guided Demo
                </a>
              </div>
            </div>

            {/* Demo cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { name: "Report Lab",  desc: "Student reports from marksheets — generated, reviewed, shared.", href: "/dem",            status: "live" as PStatus },
                { name: "Smart Pages", desc: "Upload documents and turn them into organised digital pages.",   href: "/features-demo", status: "live" as PStatus },
                { name: "Legal Smart Pages",  desc: "Document workflows for lawyers and legal teams.", href: "/demos", status: "demo" as PStatus },
                { name: "School Connect Ops", desc: "Full school operations platform — preview coming.", href: "/demos", status: "soon" as PStatus },
              ].map((d) => (
                <a
                  key={d.name}
                  href={d.href}
                  className="flex flex-col rounded-2xl p-4 border transition-all hover:-translate-y-0.5 hover:shadow-md"
                  style={{ background: "white", borderColor: "#D8E2F0", textDecoration: "none", boxShadow: "0 1px 3px rgba(11,47,107,0.05)" }}
                >
                  <StatusBadge s={d.status} />
                  <div className="mt-2 text-sm font-bold" style={{ color: "#0B2F6B" }}>{d.name}</div>
                  <div className="mt-1 text-xs leading-relaxed" style={{ color: "#6B7280" }}>{d.desc}</div>
                  {(d.status === "live" || d.status === "demo") && (
                    <div className="mt-3 flex items-center gap-1 text-xs font-semibold" style={{ color: "#0F5BD8" }}>
                      Open Demo <ArrowIco c="w-3 h-3" />
                    </div>
                  )}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Why SSAMENJ ── */}
      <section className="py-16 lg:py-24" style={{ background: "#0B2F6B" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-5"
                style={{ background: "rgba(255,255,255,0.1)", color: "#93C5FD", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                Why SSAMENJ
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                Built for real institutions,{" "}
                <span style={{ color: "#93C5FD" }}>not just demos.</span>
              </h2>
              <p className="mt-4 text-sm leading-relaxed max-w-md" style={{ color: "#93C5FD" }}>
                We build tools that actual school staff, office administrators, and legal teams can use daily — without IT support on standby.
              </p>
              <a
                href="/about"
                className="inline-flex items-center gap-2 mt-6 text-sm font-semibold transition-colors hover:opacity-80"
                style={{ color: "#BFDBFE" }}
              >
                Learn about SSAMENJ <ArrowIco c="w-4 h-4" />
              </a>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {WHY_POINTS.map((p) => (
                <div
                  key={p.title}
                  className="flex gap-4 p-4 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "#0F5BD8" }}
                  >
                    <CheckIco c="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{p.title}</div>
                    <div className="text-xs mt-0.5 leading-relaxed" style={{ color: "#93C5FD" }}>{p.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-16 lg:py-24" style={{ background: "white" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold" style={{ color: "#0B2F6B" }}>
              How it works
            </h2>
            <p className="mt-3 text-sm max-w-md mx-auto" style={{ color: "#4B5563" }}>
              Getting started with SSAMENJ is straightforward.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {HOW_STEPS.map((step) => (
              <div
                key={step.n}
                className="rounded-2xl p-6 border"
                style={{ background: "#F8FBFF", borderColor: "#E5EBF5" }}
              >
                <div
                  className="text-3xl font-black mb-4 tabular-nums"
                  style={{ color: "#EAF3FF", WebkitTextStroke: "2px #0F5BD8" }}
                >
                  {step.n}
                </div>
                <h3 className="text-sm font-bold mb-2" style={{ color: "#0B2F6B" }}>{step.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#4B5563" }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-16 lg:py-24" style={{ background: "#EAF3FF" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center p-2 border" style={{ background: "white", borderColor: "#D8E2F0" }}>
              <img src="/ssamenj-logo.png" alt="SSAMENJ Technologies" className="w-full h-full object-contain" />
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3" style={{ color: "#0B2F6B" }}>
            Ready to simplify your work?
          </h2>
          <p className="text-sm max-w-xl mx-auto mb-8 leading-relaxed" style={{ color: "#4B5563" }}>
            Let SSAMENJ Technologies help your school, office, legal team, or business move from manual work to smart digital systems.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={BOOK_DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-xl shadow-md transition-all hover:opacity-90 hover:-translate-y-px"
              style={{ background: "#0F5BD8" }}
            >
              Book a Demo <ArrowIco c="w-4 h-4" />
            </a>
            <a
              href="/demos"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl border transition-all hover:bg-white"
              style={{ color: "#0B2F6B", borderColor: "#D8E2F0", background: "rgba(255,255,255,0.7)" }}
            >
              Explore Demos
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}
