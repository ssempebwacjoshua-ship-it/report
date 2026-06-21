// ── SVG icon helpers ──────────────────────────────────────────────────────────

function Icon({ children, className = "w-5 h-5" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return <Icon className={className}><path d="m5 12 4 4 10-10" /></Icon>;
}
function SparkleIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return <Icon className={className}><path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z" /><path d="M19 12l.8 2.2L22 15l-2.2.8L19 18l-.8-2.2L16 15l2.2-.8L19 12Z" /></Icon>;
}
function ArrowRight({ className = "w-4 h-4" }: { className?: string }) {
  return <Icon className={className}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
}
function ReportIcon({ className }: { className?: string }) {
  return <Icon className={className}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></Icon>;
}
function PagesIcon({ className }: { className?: string }) {
  return <Icon className={className}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></Icon>;
}
function SchoolIcon({ className }: { className?: string }) {
  return <Icon className={className}><path d="M3 10 12 4l9 6-9 6-9-6Z" /><path d="M6 11v6c0 1.1 2.7 2 6 2s6-.9 6-2v-6" /><path d="M12 10v9" /></Icon>;
}
function ScaleIcon({ className }: { className?: string }) {
  return <Icon className={className}><path d="M12 3v18M5 7 2 17h6M19 7l3 10h-6M5 21h14" /></Icon>;
}
function WalletIcon({ className }: { className?: string }) {
  return <Icon className={className}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M16 13a1 1 0 1 0 2 0 1 1 0 0 0-2 0ZM2 10h20" /></Icon>;
}
function WristbandIcon({ className }: { className?: string }) {
  return <Icon className={className}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></Icon>;
}
function GearIcon({ className }: { className?: string }) {
  return <Icon className={className}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" /></Icon>;
}
function MarketIcon({ className }: { className?: string }) {
  return <Icon className={className}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></Icon>;
}
function CashIcon({ className }: { className?: string }) {
  return <Icon className={className}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></Icon>;
}
function WorkflowIcon({ className }: { className?: string }) {
  return <Icon className={className}><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="3" width="6" height="6" rx="1" /><rect x="15" y="15" width="6" height="6" rx="1" /><rect x="3" y="15" width="6" height="6" rx="1" /><path d="M9 6h6M9 18h6M6 9v6M18 9v6" /></Icon>;
}
function UserIcon({ className }: { className?: string }) {
  return <Icon className={className}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></Icon>;
}
function ShieldIcon({ className }: { className?: string }) {
  return <Icon className={className}><path d="M12 3 5 6v5c0 4.9 3.4 8.8 7 10 3.6-1.2 7-5.1 7-10V6l-7-3Z" /></Icon>;
}
function GlobeIcon({ className }: { className?: string }) {
  return <Icon className={className}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2Z" /></Icon>;
}
function TrendIcon({ className }: { className?: string }) {
  return <Icon className={className}><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></Icon>;
}

// ── Hero Suite visual ─────────────────────────────────────────────────────────

type SuiteStatus = "live" | "demo" | "soon";

const SUITE_ITEMS: { abbr: string; name: string; icon: React.ReactNode; status: SuiteStatus }[] = [
  { abbr: "RL", name: "Report Lab",        icon: <ReportIcon    className="w-4 h-4" />, status: "live" },
  { abbr: "SP", name: "Smart Pages",       icon: <PagesIcon     className="w-4 h-4" />, status: "live" },
  { abbr: "SC", name: "School Connect",    icon: <SchoolIcon    className="w-4 h-4" />, status: "live" },
  { abbr: "LS", name: "Legal Smart Pages", icon: <ScaleIcon     className="w-4 h-4" />, status: "demo" },
  { abbr: "PM", name: "PearlMart",         icon: <MarketIcon    className="w-4 h-4" />, status: "demo" },
  { abbr: "WC", name: "Wideh Cash",        icon: <CashIcon      className="w-4 h-4" />, status: "demo" },
  { abbr: "KW", name: "Kids Wallet",       icon: <WalletIcon    className="w-4 h-4" />, status: "soon" },
  { abbr: "NF", name: "NFC Bands",         icon: <WristbandIcon className="w-4 h-4" />, status: "soon" },
];

const SUITE_STATUS_META: Record<SuiteStatus, { dot: string; text: string; textColor: string }> = {
  live: { dot: "#22C55E", text: "Live",           textColor: "#86EFAC" },
  demo: { dot: "#3B82F6", text: "Demo Available", textColor: "#93C5FD" },
  soon: { dot: "#94A3B8", text: "Coming Soon",    textColor: "rgba(148,163,184,0.8)" },
};

function HeroSuiteVisual() {
  const liveCount = SUITE_ITEMS.filter((i) => i.status === "live").length;

  return (
    <div
      className="marketing-card-motion marketing-fade-up-delay-2 overflow-hidden"
      style={{
        borderRadius: "20px",
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Suite header bar */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="flex items-center gap-2">
          <img src="/ssamenj-logo.png" alt="" style={{ width: "20px", height: "20px", objectFit: "contain" }} />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "white", letterSpacing: "-0.01em" }}>SSAMENJ Suite</span>
          <span style={{ fontSize: "10px", color: "rgba(147,197,253,0.8)", fontWeight: 500 }}>{SUITE_ITEMS.length} products</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22C55E" }} />
          <span style={{ fontSize: "10px", color: "#86EFAC", fontWeight: 600 }}>{liveCount} Live</span>
        </div>
      </div>

      {/* Compact 2-col product grid */}
      <div className="grid grid-cols-2 gap-1.5 p-2.5">
        {SUITE_ITEMS.map((item) => {
          const m = SUITE_STATUS_META[item.status];
          const isLive = item.status === "live";
          const isDemo = item.status === "demo";
          const iconColor = isLive ? "#60A5FA" : isDemo ? "#818CF8" : "#6B7280";
          return (
            <div
              key={item.abbr}
              className="flex items-center gap-2.5"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.13)",
                borderRadius: "12px",
                padding: "10px 11px",
                minHeight: "58px",
              }}
            >
              <div
                className="flex-shrink-0 flex items-center justify-center"
                style={{ width: "28px", height: "28px", borderRadius: "8px", background: "rgba(255,255,255,0.1)", color: iconColor }}
              >
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div style={{ fontSize: "11px", fontWeight: 700, color: "white", lineHeight: 1.2 }} className="truncate">
                  {item.name}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: m.dot }} />
                  <span style={{ fontSize: "9px", fontWeight: 600, color: m.textColor }}>
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

// ── Our product family ────────────────────────────────────────────────────────

type PStatus = "live" | "demo" | "development" | "soon";

interface BuildCard {
  name: string;
  desc: string;
  icon: React.ReactNode;
  status: PStatus;
  href: string;
}

const BUILD_CARDS: BuildCard[] = [
  {
    name: "School Connect Report Lab",
    desc: "Professional student reports from marksheets — generated, reviewed, approved, and shared with parents.",
    icon: <ReportIcon className="w-5 h-5" />,
    status: "live",
    href: "/demos",
  },
  {
    name: "Smart Pages",
    desc: "Upload office or school documents and turn them into clean, editable, organized digital pages.",
    icon: <PagesIcon className="w-5 h-5" />,
    status: "live",
    href: "/features-demo",
  },
  {
    name: "Legal Smart Pages",
    desc: "Smart document workflows for lawyers — cleaning, drafting, organizing, and preparing legal documents.",
    icon: <ScaleIcon className="w-5 h-5" />,
    status: "demo",
    href: "/demos",
  },
  {
    name: "School Connect Operations",
    desc: "Student records, attendance, digital IDs, notices, wallets, and school workflows in one platform.",
    icon: <SchoolIcon className="w-5 h-5" />,
    status: "development",
    href: "/products",
  },
  {
    name: "PearlMart",
    desc: "Marketplace & digital commerce platform for product discovery, ordering workflows, and digital storefronts.",
    icon: <MarketIcon className="w-5 h-5" />,
    status: "demo",
    href: "/products#pearlmart",
  },
  {
    name: "Wideh Cash",
    desc: "Money logistics platform helping businesses manage cash movement, tracking, coordination, and workflows.",
    icon: <CashIcon className="w-5 h-5" />,
    status: "demo",
    href: "/products#wideh-cash",
  },
  {
    name: "Kids Wallet",
    desc: "Controlled student spending — linked to canteen, school fees, and activities via digital ID or wristband.",
    icon: <WalletIcon className="w-5 h-5" />,
    status: "soon",
    href: "/products",
  },
  {
    name: "NFC Wristbands",
    desc: "Smart student identification for gates, attendance, canteen, and wallet use — one tap, instant action.",
    icon: <WristbandIcon className="w-5 h-5" />,
    status: "soon",
    href: "/products",
  },
  {
    name: "Custom Digital Products",
    desc: "Purpose-built digital systems for businesses and organisations with unique workflows.",
    icon: <GearIcon className="w-5 h-5" />,
    status: "live",
    href: "/contact",
  },
];

const STATUS_LABEL: Record<PStatus, { label: string; bg: string; color: string; dot: string }> = {
  live:        { label: "Live",           bg: "#DCFCE7", color: "#16A34A", dot: "#22C55E" },
  demo:        { label: "Demo Available", bg: "#DBEAFE", color: "#1D4ED8", dot: "#3B82F6" },
  development: { label: "In Development", bg: "#FEF3C7", color: "#B45309", dot: "#F59E0B" },
  soon:        { label: "Coming Soon",    bg: "#F1F5F9", color: "#64748B", dot: "#CBD5E1" },
};

function StatusPill({ status }: { status: PStatus }) {
  const s = STATUS_LABEL[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ background: s.bg, color: s.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

// ── Why SSAMENJ cards ─────────────────────────────────────────────────────────

const WHY_CARDS = [
  {
    icon: <WorkflowIcon className="w-6 h-6" />,
    title: "Built for real workflows",
    body: "Every product is designed around how institutions actually work — not how software expects them to work.",
  },
  {
    icon: <UserIcon className="w-6 h-6" />,
    title: "Simple for everyday users",
    body: "Teachers, clerks, and front-line staff can use our systems without IT support or technical training.",
  },
  {
    icon: <ShieldIcon className="w-6 h-6" />,
    title: "Secure and organised",
    body: "Each institution's data is isolated, protected, and auditable. We take data responsibility seriously.",
  },
  {
    icon: <GlobeIcon className="w-6 h-6" />,
    title: "Designed for African institutions",
    body: "We understand local operational realities while building to global software standards.",
  },
  {
    icon: <TrendIcon className="w-6 h-6" />,
    title: "Ready for growth",
    body: "Our systems scale with your institution — from a single school to a multi-campus network.",
  },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export function AboutPage() {
  return (
    <div style={{ background: "#F8FBFF" }}>

      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden border-b"
        style={{
          backgroundImage: "linear-gradient(135deg, rgba(8,18,55,0.97) 0%, rgba(11,47,107,0.95) 40%, rgba(15,91,216,0.88) 100%)",
          borderColor: "rgba(15,91,216,0.2)",
        }}
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: "radial-gradient(white 1px, transparent 1px)", backgroundSize: "26px 26px" }}
        />

        <div className="relative mx-auto grid max-w-7xl gap-6 px-4 pt-10 pb-8 sm:px-6 lg:grid-cols-2 lg:px-8 lg:pt-12 lg:pb-10 items-center">

          {/* Left */}
          <div className="marketing-fade-up">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">
              <SparkleIcon />
              About SSAMENJ Technologies
            </div>

            {/* Headline */}
            <h1 className="marketing-fade-up-delay-1 mt-3 max-w-xl text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-[42px]">
              We build practical digital systems for{" "}
              <span style={{ color: "#93C5FD" }}>real institutions.</span>
            </h1>

            {/* Subheadline */}
            <p className="marketing-fade-up-delay-2 mt-3 max-w-xl text-[15px] leading-relaxed text-blue-100">
              SSAMENJ Technologies builds software products that help schools, offices, businesses, and institutions reduce paperwork, organize work, and move faster with secure digital workflows.
            </p>

            {/* CTAs */}
            <div className="marketing-fade-up-delay-3 mt-5 flex flex-col gap-3 sm:flex-row">
              <a
                href="/products"
                className="btn marketing-button-motion inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-black text-blue-700 hover:bg-blue-50 transition-colors"
              >
                View Products
                <ArrowRight />
              </a>
              <a
                href="/demos"
                className="btn marketing-button-motion inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/15 transition-colors"
              >
                View Demos
              </a>
            </div>

            {/* Trust badges desktop */}
            <div className="marketing-fade-up mt-6 hidden lg:grid grid-cols-3 gap-3">
              {[
                { value: String(BUILD_CARDS.length), label: "DIGITAL PRODUCTS" },
                { value: "3+",                       label: "LIVE NOW" },
                { value: "4+",                       label: "IN PIPELINE" },
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
              { value: String(BUILD_CARDS.length), label: "DIGITAL PRODUCTS" },
              { value: "3+",                       label: "LIVE NOW" },
              { value: "4+",                       label: "IN PIPELINE" },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-center">
                <div className="text-xl font-black text-white">{m.value}</div>
                <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-blue-200">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who We Are ── */}
      <section className="py-8 lg:py-10" style={{ background: "white" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Text */}
            <div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
                style={{ background: "#EAF3FF", color: "#0F5BD8" }}
              >
                Who We Are
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold mb-4 leading-snug" style={{ color: "#111827" }}>
                Practical software for real institutions.
              </h2>
              <div className="space-y-3 text-sm leading-relaxed" style={{ color: "#4B5563" }}>
                <p>
                  SSAMENJ Technologies builds smart, simple, and reliable digital systems for real institutions. Our work focuses on practical tools that help teams save time, reduce errors, and serve people better.
                </p>
                <p>
                  We started with school report cards — a time-consuming manual process in thousands of schools. From there we expanded into document management, legal workflows, commerce, and money logistics. Each product is born from a real problem in a real institution.
                </p>
                <p>
                  Today, SSAMENJ is building a connected suite of products under one company identity — with a long-term commitment to software that African institutions are proud to use.
                </p>
              </div>
            </div>

            {/* Mission + slogan cards */}
            <div className="space-y-4">
              <div
                className="rounded-2xl p-6"
                style={{ background: "#EAF3FF", border: "1px solid #D8E2F0" }}
              >
                <div className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "#0F5BD8" }}>
                  Our Mission
                </div>
                <p className="text-base font-bold leading-snug" style={{ color: "#0B2F6B" }}>
                  To help schools, offices, legal teams, and businesses move from manual paperwork to smart, secure, and connected digital systems.
                </p>
              </div>

              <div className="rounded-2xl p-6" style={{ background: "#0B2F6B" }}>
                <div className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "#93C5FD" }}>
                  Our Slogan
                </div>
                <p className="text-2xl font-extrabold text-white">Smart Systems.</p>
                <p className="text-2xl font-extrabold" style={{ color: "#93C5FD" }}>Simple Work.</p>
                <p className="mt-2 text-xs leading-relaxed" style={{ color: "#93C5FD" }}>
                  Every product decision is measured against this — does it make the work simpler for the people using it?
                </p>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { v: String(BUILD_CARDS.length), l: "Products" },
                  { v: "3+",                       l: "Live now" },
                  { v: "4+",                       l: "In pipeline" },
                ].map((s) => (
                  <div
                    key={s.l}
                    className="rounded-xl p-4 text-center border"
                    style={{ background: "white", borderColor: "#D8E2F0" }}
                  >
                    <div className="text-xl font-black" style={{ color: "#0B2F6B" }}>{s.v}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Our Product Family ── */}
      <section className="py-8 lg:py-10" style={{ background: "#EAF3FF" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
              style={{ background: "white", color: "#0F5BD8" }}
            >
              Our Product Family
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold" style={{ color: "#111827" }}>
              A connected suite of digital products
            </h2>
            <p className="mt-3 text-sm max-w-xl mx-auto" style={{ color: "#4B5563" }}>
              Each product is purpose-built for a real institution challenge. No bloated features — just tools that work.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {BUILD_CARDS.map((card) => (
              <a
                key={card.name}
                href={card.href}
                className="group flex flex-col rounded-2xl p-5 border transition-all hover:-translate-y-1 hover:shadow-md"
                style={{ background: "white", borderColor: "#D8E2F0", boxShadow: "0 2px 8px rgba(11,47,107,0.05)", textDecoration: "none" }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "#EAF3FF", color: "#0F5BD8" }}
                  >
                    {card.icon}
                  </div>
                  <StatusPill status={card.status} />
                </div>
                <h3 className="text-sm font-bold mb-1.5 leading-snug" style={{ color: "#111827" }}>
                  {card.name}
                </h3>
                <p className="text-xs leading-relaxed flex-1" style={{ color: "#4B5563" }}>
                  {card.desc}
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold transition-colors group-hover:opacity-70" style={{ color: "#0F5BD8" }}>
                  {card.status === "live" || card.status === "demo" ? "View Demo" : "Learn More"}
                  <ArrowRight className="w-3 h-3" />
                </div>
              </a>
            ))}
          </div>

          <div className="mt-8 text-center">
            <a
              href="/products"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
              style={{ background: "#0B2F6B" }}
            >
              See all products in detail
              <ArrowRight />
            </a>
          </div>
        </div>
      </section>

      {/* ── Why We Build ── */}
      <section className="py-8 lg:py-10" style={{ background: "white" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
              style={{ background: "#EAF3FF", color: "#0F5BD8" }}
            >
              Why We Build
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold" style={{ color: "#111827" }}>
              Built for real institutions, not just demos.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {WHY_CARDS.map((card, i) => (
              <div
                key={card.title}
                className="rounded-2xl p-6 border flex gap-4"
                style={{ background: "#F8FBFF", borderColor: "#D8E2F0" }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "#EAF3FF", color: "#0F5BD8" }}
                >
                  {card.icon}
                </div>
                <div>
                  <div className="text-[10px] font-black mb-1" style={{ color: "#D8E2F0" }}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="text-sm font-bold mb-1" style={{ color: "#111827" }}>
                    {card.title}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: "#4B5563" }}>
                    {card.body}
                  </p>
                </div>
              </div>
            ))}

            {/* CTA filler card */}
            <div
              className="rounded-2xl p-6 flex flex-col items-start justify-between border"
              style={{ background: "#0B2F6B", borderColor: "#0B2F6B" }}
            >
              <div>
                <div className="text-base font-extrabold text-white mb-2">
                  Ready to see it in action?
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "#93C5FD" }}>
                  Explore our product demos or book a guided walkthrough with our team.
                </p>
              </div>
              <a
                href="/demos"
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                style={{ background: "white", color: "#0B2F6B" }}
              >
                View Demos
                <ArrowRight />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Who We Serve ── */}
      <section className="py-8 lg:py-10" style={{ background: "#EAF3FF" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
                style={{ background: "white", color: "#0F5BD8" }}
              >
                Who We Serve
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold mb-4" style={{ color: "#111827" }}>
                Institutions across Africa and beyond.
              </h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "#4B5563" }}>
                We build for institutions that have outgrown spreadsheets and paper but haven't found software that truly fits. Our products are designed to meet you where you are and grow with you.
              </p>
              <a
                href="/contact"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ background: "#0F5BD8" }}
              >
                Talk to us about your needs
                <ArrowRight />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { sector: "Schools",              desc: "Primary, secondary, and tertiary institutions across Uganda and East Africa.",        icon: <SchoolIcon   className="w-5 h-5" /> },
                { sector: "Law Firms",            desc: "Legal practices that need cleaner, safer, and faster document workflows.",            icon: <ScaleIcon    className="w-5 h-5" /> },
                { sector: "Offices & Businesses", desc: "Growing businesses that need structure and digital systems to scale.",                icon: <WorkflowIcon className="w-5 h-5" /> },
                { sector: "NGOs & Organisations", desc: "Institutions with unique workflows requiring custom digital solutions.",              icon: <GlobeIcon    className="w-5 h-5" /> },
              ].map((s) => (
                <div
                  key={s.sector}
                  className="rounded-2xl p-5 border flex flex-col gap-3"
                  style={{ background: "white", borderColor: "#D8E2F0" }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "#EAF3FF", color: "#0F5BD8" }}
                  >
                    {s.icon}
                  </div>
                  <div>
                    <div className="text-sm font-bold" style={{ color: "#111827" }}>{s.sector}</div>
                    <div className="text-xs mt-1 leading-relaxed" style={{ color: "#6B7280" }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section
        className="py-8 lg:py-10"
        style={{ background: "linear-gradient(135deg, #0B2F6B 0%, #0F5BD8 100%)" }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-5">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center p-2"
              style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              <img src="/ssamenj-logo.png" alt="SSAMENJ Technologies" className="w-full h-full object-contain" />
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
            Ready to simplify your work?
          </h2>
          <p className="text-sm max-w-xl mx-auto mb-6 leading-relaxed" style={{ color: "#BFDBFE" }}>
            Let SSAMENJ Technologies help your school, office, legal team, or business move from manual work to smart digital systems.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="/products"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl shadow-lg transition-all hover:opacity-90 hover:-translate-y-px"
              style={{ background: "white", color: "#0B2F6B" }}
            >
              View Products
              <ArrowRight />
            </a>
            <a
              href="/demos"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl transition-all hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              Explore Demos
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}
