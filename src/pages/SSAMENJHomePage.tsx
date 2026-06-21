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
const SparkleIco    = ({ c = "w-3.5 h-3.5" }: { c?: string }) => <Ico className={c}><path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z" /><path d="M19 12l.8 2.2L22 15l-2.2.8L19 18l-.8-2.2L16 15l2.2-.8L19 12Z" /></Ico>;
const ArrowIco      = ({ c = "w-4 h-4" }: { c?: string }) => <Ico className={c}><path d="M5 12h14M13 6l6 6-6 6" /></Ico>;
const CheckIco      = ({ c = "w-4 h-4" }: { c?: string }) => <Ico className={c}><path d="m5 12 4 4 10-10" /></Ico>;
const ReportIco     = ({ c = "w-5 h-5" }: { c?: string }) => <Ico className={c}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></Ico>;
const PagesIco      = ({ c = "w-5 h-5" }: { c?: string }) => <Ico className={c}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></Ico>;
const SchoolIco     = ({ c = "w-5 h-5" }: { c?: string }) => <Ico className={c}><path d="M3 10 12 4l9 6-9 6-9-6Z" /><path d="M6 11v6c0 1.1 2.7 2 6 2s6-.9 6-2v-6" /><path d="M12 10v9" /></Ico>;
const ScaleIco      = ({ c = "w-5 h-5" }: { c?: string }) => <Ico className={c}><path d="M12 3v18M5 7 2 17h6M19 7l3 10h-6M5 21h14" /></Ico>;
const WalletIco     = ({ c = "w-5 h-5" }: { c?: string }) => <Ico className={c}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M16 13a1 1 0 1 0 2 0 1 1 0 0 0-2 0ZM2 10h20" /></Ico>;
const WristbandIco  = ({ c = "w-5 h-5" }: { c?: string }) => <Ico className={c}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></Ico>;
const GearIco       = ({ c = "w-5 h-5" }: { c?: string }) => <Ico className={c}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" /></Ico>;
const WorkflowIco   = ({ c = "w-5 h-5" }: { c?: string }) => <Ico className={c}><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="3" width="6" height="6" rx="1" /><rect x="15" y="15" width="6" height="6" rx="1" /><rect x="3" y="15" width="6" height="6" rx="1" /><path d="M9 6h6M9 18h6M6 9v6M18 9v6" /></Ico>;
const UserIco       = ({ c = "w-5 h-5" }: { c?: string }) => <Ico className={c}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></Ico>;
const ShieldIco     = ({ c = "w-5 h-5" }: { c?: string }) => <Ico className={c}><path d="M12 3 5 6v5c0 4.9 3.4 8.8 7 10 3.6-1.2 7-5.1 7-10V6l-7-3Z" /></Ico>;
const GlobeIco      = ({ c = "w-5 h-5" }: { c?: string }) => <Ico className={c}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2Z" /></Ico>;
const TrendIco      = ({ c = "w-5 h-5" }: { c?: string }) => <Ico className={c}><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></Ico>;

// ── Hero Suite visual ─────────────────────────────────────────────────────────

const SUITE_ITEMS = [
  { abbr: "RL", name: "Report Lab",        icon: <ReportIco    c="w-4 h-4" />, status: "live"  as const },
  { abbr: "SP", name: "Smart Pages",       icon: <PagesIco     c="w-4 h-4" />, status: "live"  as const },
  { abbr: "SC", name: "School Connect",    icon: <SchoolIco    c="w-4 h-4" />, status: "live"  as const },
  { abbr: "LS", name: "Legal Smart Pages", icon: <ScaleIco     c="w-4 h-4" />, status: "demo"  as const },
  { abbr: "KW", name: "Kids Wallet",       icon: <WalletIco    c="w-4 h-4" />, status: "soon"  as const },
  { abbr: "NF", name: "NFC Wristbands",    icon: <WristbandIco c="w-4 h-4" />, status: "soon"  as const },
  { abbr: "CD", name: "Custom Digital",    icon: <GearIco      c="w-4 h-4" />, status: "live"  as const },
];

const STATUS_META = {
  live: { dot: "#22C55E", text: "Live",            textColor: "#16A34A" },
  demo: { dot: "#3B82F6", text: "Demo Available",  textColor: "#1D4ED8" },
  soon: { dot: "#94A3B8", text: "Coming Soon",      textColor: "#64748B" },
};

function HeroSuiteVisual() {
  return (
    <div
      className="marketing-card-motion marketing-fade-up-delay-2 overflow-hidden"
      style={{ borderRadius: "20px", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      {/* Suite header bar */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="flex items-center gap-2">
          <img src="/ssamenj-logo.png" alt="" style={{ width: "20px", height: "20px", objectFit: "contain" }} />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "white", letterSpacing: "-0.01em" }}>SSAMENJ Suite</span>
          <span style={{ fontSize: "10px", color: "rgba(147,197,253,0.8)", fontWeight: 500 }}>7 products</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22C55E" }} />
          <span style={{ fontSize: "10px", color: "#86EFAC", fontWeight: 600 }}>3 Live</span>
        </div>
      </div>

      {/* Compact 2-col product grid */}
      <div className="grid grid-cols-2 gap-1.5 p-2.5">
        {SUITE_ITEMS.map((item) => {
          const m = STATUS_META[item.status];
          const isLive = item.status === "live";
          const isDemo = item.status === "demo";
          const iconColor = isLive ? "#60A5FA" : isDemo ? "#818CF8" : "#6B7280";
          const dotColor = m.dot;
          return (
            <div
              key={item.abbr}
              className="flex items-center gap-2.5"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.13)",
                borderRadius: "12px",
                padding: "10px 11px",
                minHeight: "60px",
              }}
            >
              {/* Icon */}
              <div
                className="flex-shrink-0 flex items-center justify-center"
                style={{ width: "28px", height: "28px", borderRadius: "8px", background: "rgba(255,255,255,0.1)", color: iconColor }}
              >
                {item.icon}
              </div>
              {/* Text */}
              <div className="min-w-0 flex-1">
                <div style={{ fontSize: "11px", fontWeight: 700, color: "white", lineHeight: 1.2 }} className="truncate">
                  {item.name}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                  <span style={{ fontSize: "9px", fontWeight: 600, color: isLive ? "#86EFAC" : isDemo ? "#93C5FD" : "rgba(148,163,184,0.8)" }}>
                    {m.text}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-3.5 py-2"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <span style={{ fontSize: "9px", fontWeight: 600, color: "rgba(147,197,253,0.6)" }}>Smart Systems. Simple Work.</span>
        <span style={{ fontSize: "9px", fontWeight: 600, color: "rgba(147,197,253,0.5)" }}>ssamenj.com</span>
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
  { name: "School Connect Report Lab",  tagline: "Generate, review, and share professional student reports from marksheets.", icon: <ReportIco />,    status: "live",        href: "/demos",    ctaLabel: "View Demo"  },
  { name: "Smart Pages",               tagline: "Turn raw documents into clean, editable, shareable digital pages.",         icon: <PagesIco />,    status: "live",        href: "/demos",    ctaLabel: "View Demo"  },
  { name: "Legal Smart Pages",         tagline: "Smart document workflows for lawyers and legal teams.",                     icon: <ScaleIco />,    status: "demo",        href: "/demos",    ctaLabel: "Explore"    },
  { name: "School Connect Operations", tagline: "Student records, attendance, IDs, notices, and workflows in one platform.", icon: <SchoolIco />,   status: "development", href: "/products", ctaLabel: "Learn More" },
  { name: "Kids Wallet",               tagline: "Controlled school spending linked to digital ID or NFC wristband.",         icon: <WalletIco />,   status: "soon",        href: "/products", ctaLabel: "Coming Soon"},
  { name: "NFC Wristbands",            tagline: "Smart student identification for gates, canteen, and attendance.",          icon: <WristbandIco />,status: "soon",        href: "/products", ctaLabel: "Coming Soon"},
  { name: "Custom Digital Products",   tagline: "Purpose-built systems for organisations with unique workflows.",            icon: <GearIco />,     status: "live",        href: "/contact",  ctaLabel: "Get in Touch"},
];

const PBADGE: Record<PStatus, { label: string; bg: string; color: string; dot: string }> = {
  live:        { label: "Live",           bg: "#DCFCE7", color: "#16A34A", dot: "#22C55E" },
  demo:        { label: "Demo Available", bg: "#DBEAFE", color: "#1D4ED8", dot: "#3B82F6" },
  development: { label: "In Development", bg: "#FEF3C7", color: "#B45309", dot: "#F59E0B" },
  soon:        { label: "Coming Soon",    bg: "#F1F5F9", color: "#64748B", dot: "#CBD5E1" },
};

function ProductCard({ p }: { p: Product }) {
  const badge = PBADGE[p.status];
  const isSoon = p.status === "soon";
  return (
    <div
      className="group relative flex flex-col rounded-2xl border p-6 transition-all hover:-translate-y-1 hover:shadow-lg"
      style={{ background: "white", borderColor: "#E5EBF5", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(11,47,107,0.05)" }}
    >
      <div className="absolute top-0 inset-x-0 h-0.5 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "linear-gradient(90deg, #0F5BD8, #60A5FA)" }} />
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#EAF3FF", color: "#0F5BD8" }}>
          {p.icon}
        </div>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: badge.bg, color: badge.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: badge.dot }} />
          {badge.label}
        </span>
      </div>
      <h3 className="text-[15px] font-bold leading-snug mb-2" style={{ color: "#0B2F6B" }}>{p.name}</h3>
      <p className="text-sm leading-relaxed flex-1" style={{ color: "#4B5563" }}>{p.tagline}</p>
      <div className="mt-5 pt-4 border-t" style={{ borderColor: "#F1F5F9" }}>
        {isSoon ? (
          <span className="text-sm font-medium" style={{ color: "#94A3B8" }}>Coming Soon</span>
        ) : (
          <a href={p.href} className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors hover:opacity-70" style={{ color: "#0F5BD8" }}>
            {p.ctaLabel} <ArrowIco c="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

// ── Why SSAMENJ ───────────────────────────────────────────────────────────────

const WHY = [
  { icon: <WorkflowIco />, title: "Built for real workflows",     body: "Every product is designed around how institutions actually work — not how software expects them to." },
  { icon: <UserIco />,     title: "Simple for everyday users",   body: "Teachers, clerks, and front-line staff can use our systems without IT support or training." },
  { icon: <ShieldIco />,   title: "Secure and organised",        body: "Each institution's data is isolated, protected, and auditable. We take data responsibility seriously." },
  { icon: <GlobeIco />,    title: "Built for African institutions", body: "We understand local operational realities while building to global software standards." },
  { icon: <TrendIco />,    title: "Ready for growth",             body: "From a single school to a multi-campus network — our systems scale with you." },
];

const HOW = [
  { n: "01", title: "Understand your workflow",        body: "We map how your team actually works before proposing anything." },
  { n: "02", title: "Configure the right solution",   body: "We set up the system specifically for your institution's needs." },
  { n: "03", title: "Your team starts working faster", body: "Staff get training and support until the system feels natural." },
  { n: "04", title: "Manage, track, and grow",         body: "Dashboards and reports keep you in control as you scale." },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export function SSAMENJHomePage() {
  return (
    <div className="min-h-screen" style={{ background: "#F8FBFF" }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden border-b"
        style={{
          backgroundImage: "linear-gradient(135deg, rgba(8,18,55,0.97) 0%, rgba(11,47,107,0.95) 40%, rgba(15,91,216,0.88) 100%)",
          borderColor: "rgba(15,91,216,0.2)",
        }}
      >
        {/* Dot grid */}
        <div className="absolute inset-0 bg-dot-grid opacity-[0.15]" />

        <div className="relative mx-auto grid max-w-7xl gap-6 px-4 pt-20 pb-10 sm:px-6 lg:grid-cols-2 lg:px-8 lg:pt-24 lg:pb-16 xl:pb-20 items-center">

          {/* Left */}
          <div>
            {/* Badge */}
            <div className="marketing-fade-up inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">
              <SparkleIco />
              SSAMENJ Technologies
            </div>

            {/* Headline */}
            <h1 className="marketing-fade-up-delay-1 mt-3 max-w-xl text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-[42px]">
              Smart systems for schools, offices, and growing businesses.
            </h1>

            {/* Subheadline */}
            <p className="marketing-fade-up-delay-2 mt-3 max-w-xl text-[15px] leading-relaxed text-blue-100">
              SSAMENJ Technologies builds practical digital tools that reduce paperwork, organise work, and help institutions serve people faster.
            </p>

            {/* CTAs */}
            <div className="marketing-fade-up-delay-3 mt-5 flex flex-col gap-3 sm:flex-row">
              <a
                href="/demos"
                className="btn marketing-button-motion inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-black text-blue-700 hover:bg-blue-50 transition-colors"
              >
                View Demos
                <ArrowIco />
              </a>
              <a
                href="/products"
                className="btn marketing-button-motion inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/15 transition-colors"
              >
                Explore Products
              </a>
              <a
                href={BOOK_DEMO_URL}
                target="_blank"
                rel="noreferrer"
                className="btn marketing-button-motion inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/8 px-5 py-2.5 text-sm font-bold text-white/80 hover:bg-white/12 transition-colors"
              >
                Book Demo
              </a>
            </div>

            {/* Trust badges */}
            <div className="marketing-fade-up mt-6 hidden lg:grid grid-cols-3 gap-3">
              {[
                { value: "7",   label: "DIGITAL PRODUCTS" },
                { value: "3+",  label: "LIVE NOW" },
                { value: "4+",  label: "IN PIPELINE" },
              ].map((m) => (
                <div key={m.label} className="rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-center">
                  <div className="text-xl font-black text-white">{m.value}</div>
                  <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-blue-200">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Suite visual */}
          <div className="mt-2 lg:mt-0">
            <HeroSuiteVisual />
          </div>

          {/* Trust badges mobile */}
          <div className="grid grid-cols-3 gap-3 lg:hidden">
            {[
              { value: "7",   label: "DIGITAL PRODUCTS" },
              { value: "3+",  label: "LIVE NOW" },
              { value: "4+",  label: "IN PIPELINE" },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-center">
                <div className="text-xl font-black text-white">{m.value}</div>
                <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-blue-200">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Products section ───────────────────────────────────────────────── */}
      <section className="py-14 lg:py-20" style={{ background: "white" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4 border"
              style={{ background: "#EAF3FF", color: "#0F5BD8", borderColor: "#D8E2F0" }}
            >
              Our Products
            </div>
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
              See full product details
              <ArrowIco />
            </a>
          </div>
        </div>
      </section>

      {/* ── Demos banner ───────────────────────────────────────────────────── */}
      <section className="py-14 lg:py-16" style={{ background: "#EAF3FF" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4 border"
                style={{ background: "white", color: "#0F5BD8", borderColor: "#D8E2F0" }}
              >
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
                  View All Demos <ArrowIco />
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { name: "Report Lab",          desc: "Student reports from marksheets — generated, reviewed, shared.",   href: "/demos", status: "live"  as const },
                { name: "Smart Pages",         desc: "Upload documents, turn them into organised digital pages.",         href: "/demos", status: "live"  as const },
                { name: "Legal Smart Pages",   desc: "Document workflows for lawyers and legal teams.",                   href: "/demos", status: "demo"  as const },
                { name: "School Connect Ops",  desc: "Full school operations platform — preview coming.",                 href: "/demos", status: "soon"  as const },
              ].map((d) => {
                const b = PBADGE[d.status];
                return (
                  <a
                    key={d.name}
                    href={d.href}
                    className="flex flex-col rounded-2xl p-4 border transition-all hover:-translate-y-0.5 hover:shadow-md"
                    style={{ background: "white", borderColor: "#D8E2F0", textDecoration: "none", boxShadow: "0 1px 3px rgba(11,47,107,0.05)" }}
                  >
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold w-fit" style={{ background: b.bg, color: b.color }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: b.dot }} />
                      {b.label}
                    </span>
                    <div className="mt-2 text-sm font-bold" style={{ color: "#0B2F6B" }}>{d.name}</div>
                    <div className="mt-1 text-xs leading-relaxed" style={{ color: "#6B7280" }}>{d.desc}</div>
                    {(d.status === "live" || d.status === "demo") && (
                      <div className="mt-3 flex items-center gap-1 text-xs font-semibold" style={{ color: "#0F5BD8" }}>
                        Open Demo <ArrowIco c="w-3 h-3" />
                      </div>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Why SSAMENJ ────────────────────────────────────────────────────── */}
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
              <a href="/about" className="inline-flex items-center gap-2 mt-6 text-sm font-semibold hover:opacity-80" style={{ color: "#BFDBFE" }}>
                Learn about SSAMENJ <ArrowIco />
              </a>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {WHY.map((w) => (
                <div
                  key={w.title}
                  className="flex gap-4 p-4 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#0F5BD8", color: "white" }}>
                    <CheckIco />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{w.title}</div>
                    <div className="text-xs mt-0.5 leading-relaxed" style={{ color: "#93C5FD" }}>{w.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="py-16 lg:py-20" style={{ background: "white" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold" style={{ color: "#0B2F6B" }}>How it works</h2>
            <p className="mt-3 text-sm max-w-md mx-auto" style={{ color: "#4B5563" }}>Getting started is straightforward.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {HOW.map((s) => (
              <div key={s.n} className="rounded-2xl p-6 border" style={{ background: "#F8FBFF", borderColor: "#E5EBF5" }}>
                <div className="text-3xl font-black mb-4 tabular-nums" style={{ color: "#EAF3FF", WebkitTextStroke: "2px #0F5BD8" }}>
                  {s.n}
                </div>
                <h3 className="text-sm font-bold mb-2" style={{ color: "#0B2F6B" }}>{s.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#4B5563" }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────────── */}
      <section className="py-16 lg:py-20" style={{ background: "#EAF3FF" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center p-2.5 border" style={{ background: "white", borderColor: "#D8E2F0" }}>
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
              Book a Demo <ArrowIco />
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
