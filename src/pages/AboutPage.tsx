import { MarketingHeader } from "../components/marketing/MarketingHeader";
import { MarketingFooter } from "../components/marketing/MarketingFooter";
import { FloatingWhatsAppButton } from "../components/marketing/FloatingWhatsAppButton";

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

// ── Hero product visual ───────────────────────────────────────────────────────

const HERO_CARDS = [
  { abbr: "RL", name: "Report Lab",        status: "live" as const },
  { abbr: "SP", name: "Smart Pages",       status: "live" as const },
  { abbr: "SC", name: "School Connect",    status: "live" as const },
  { abbr: "LS", name: "Legal Smart Pages", status: "demo" as const },
  { abbr: "KW", name: "Kids Wallet",       status: "soon" as const },
  { abbr: "NF", name: "NFC Wristbands",    status: "soon" as const },
];

function HeroProductVisual() {
  return (
    <div className="relative">
      {/* Ambient glows */}
      <div className="absolute -top-6 -right-6 w-36 h-36 rounded-full blur-3xl opacity-25" style={{ background: "#60A5FA" }} />
      <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full blur-2xl opacity-20" style={{ background: "#0B2F6B" }} />

      {/* Browser chrome */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ border: "1px solid rgba(255,255,255,0.15)" }}>
        {/* Title bar */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)" }}>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#F87171" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#FBBF24" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#34D399" }} />
          </div>
          <div className="flex items-center gap-2 flex-1 mx-2 px-3 py-1 rounded-md text-[11px]" style={{ background: "rgba(255,255,255,0.1)", color: "#93C5FD" }}>
            <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
            app.ssamenj.com
          </div>
        </div>

        {/* App bar */}
        <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div>
            <div className="text-[11px] font-bold text-white">SSAMENJ Suite</div>
            <div className="text-[9px]" style={{ color: "#93C5FD" }}>7 digital products</div>
          </div>
          <div className="text-[9px] font-semibold px-2 py-1 rounded-full" style={{ background: "rgba(15,91,216,0.5)", color: "#BFDBFE" }}>
            All Institutions
          </div>
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-2 gap-2 p-3" style={{ background: "rgba(255,255,255,0.05)" }}>
          {HERO_CARDS.map((p) => {
            const isLive = p.status === "live";
            const isDemo = p.status === "demo";
            return (
              <div
                key={p.abbr}
                className="rounded-xl p-3"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black"
                    style={{
                      background: isLive ? "rgba(15,91,216,0.5)" : isDemo ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)",
                      color: isLive ? "#BFDBFE" : isDemo ? "#C4B5FD" : "#6B7280",
                    }}
                  >
                    {p.abbr}
                  </div>
                  <div
                    className="w-2 h-2 rounded-full mt-0.5"
                    style={{ background: isLive ? "#34D399" : isDemo ? "#60A5FA" : "#4B5563" }}
                  />
                </div>
                <div className="text-[11px] font-semibold text-white leading-snug">{p.name}</div>
                <div
                  className="mt-1 text-[9px] font-medium"
                  style={{ color: isLive ? "#34D399" : isDemo ? "#60A5FA" : "#6B7280" }}
                >
                  {isLive ? "● Live" : isDemo ? "● Demo" : "○ Coming Soon"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Products we build ─────────────────────────────────────────────────────────

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
    href: "/dem",
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
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      <MarketingHeader activePath="/about" />

      {/* ── Hero ── */}
      <section
        className="relative pt-20 pb-12 lg:pt-28 lg:pb-16 overflow-hidden"
        style={{ background: "linear-gradient(155deg, #0B2F6B 0%, #0F5BD8 55%, #1A72F0 100%)" }}
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(white 1px, transparent 1px)", backgroundSize: "26px 26px" }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            {/* Left */}
            <div className="marketing-fade-up">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-5"
                style={{ background: "rgba(255,255,255,0.12)", color: "#BFDBFE", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                About SSAMENJ Technologies
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
                We build digital systems that{" "}
                <span style={{ color: "#93C5FD" }}>institutions can actually use.</span>
              </h1>

              <p className="mt-5 text-base leading-relaxed" style={{ color: "#BFDBFE", maxWidth: "500px" }}>
                SSAMENJ Technologies is a digital solutions company building practical software for schools, offices, legal teams, and growing businesses. We help institutions reduce paperwork, organise daily work, and move into secure digital workflows.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href="/demos"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:-translate-y-px"
                  style={{ background: "#0F5BD8", border: "1px solid rgba(255,255,255,0.2)" }}
                >
                  View Demos
                  <ArrowRight />
                </a>
                <a
                  href="/contact"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                  style={{ background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.2)" }}
                >
                  Book a Demo
                </a>
              </div>
            </div>

            {/* Right — product visual */}
            <div className="marketing-fade-up-delay-1 hidden sm:block">
              <HeroProductVisual />
            </div>
          </div>
        </div>
      </section>

      {/* ── Who We Are ── */}
      <section className="py-14 lg:py-20" style={{ background: "white" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
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
                  We started with school report cards — a time-consuming manual process in thousands of schools. From there we expanded into document management, legal workflows, and school operations. Each product is born from a real problem in a real institution.
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

              <div
                className="rounded-2xl p-6"
                style={{ background: "#0B2F6B" }}
              >
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
                  { v: "7", l: "Products" },
                  { v: "3+", l: "Live now" },
                  { v: "4+", l: "In pipeline" },
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

      {/* ── What We Build ── */}
      <section className="py-14 lg:py-20" style={{ background: "#EAF3FF" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
              style={{ background: "white", color: "#0F5BD8" }}
            >
              What We Build
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

      {/* ── Why SSAMENJ ── */}
      <section className="py-14 lg:py-20" style={{ background: "white" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
              style={{ background: "#EAF3FF", color: "#0F5BD8" }}
            >
              Why SSAMENJ
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
                  <div className="text-[10px] font-black text-[#D8E2F0] mb-1">
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

            {/* Filler card with CTA */}
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

      {/* ── Who we serve ── */}
      <section className="py-14 lg:py-20" style={{ background: "#EAF3FF" }}>
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
                { sector: "Schools", desc: "Primary, secondary, and tertiary institutions across Uganda and East Africa.", icon: <SchoolIcon className="w-5 h-5" /> },
                { sector: "Law Firms", desc: "Legal practices that need cleaner, safer, and faster document workflows.", icon: <ScaleIcon className="w-5 h-5" /> },
                { sector: "Offices & Businesses", desc: "Growing businesses that need structure and digital systems to scale.", icon: <WorkflowIcon className="w-5 h-5" /> },
                { sector: "NGOs & Organisations", desc: "Institutions with unique workflows requiring custom digital solutions.", icon: <GlobeIcon className="w-5 h-5" /> },
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
        className="py-14 lg:py-20"
        style={{ background: "linear-gradient(135deg, #0B2F6B 0%, #0F5BD8 100%)" }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Logo */}
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
          <p className="text-sm max-w-xl mx-auto mb-8 leading-relaxed" style={{ color: "#BFDBFE" }}>
            Let SSAMENJ Technologies help your school, office, legal team, or business move from manual work to smart digital systems.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="/demos"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl shadow-lg transition-all hover:opacity-90 hover:-translate-y-px"
              style={{ background: "white", color: "#0B2F6B" }}
            >
              View Demos
              <ArrowRight />
            </a>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl transition-all hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              Book a Demo
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter />
      <FloatingWhatsAppButton />
    </div>
  );
}
