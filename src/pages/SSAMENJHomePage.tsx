import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { MarketingHeader } from "../components/marketing/MarketingHeader";
import { MarketingFooter } from "../components/marketing/MarketingFooter";
import { FloatingWhatsAppButton } from "../components/marketing/FloatingWhatsAppButton";
import { buildWhatsAppUrl } from "../config/contact";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I'd like to book a product demo for my organisation.",
);

// ── SVG icon helpers ─────────────────────────────────────────────────────────

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
  return <Icon className={className}><path d="M3 10 12 4l9 6-9 6-9-6Z" /><path d="M6 11v6c0 1.1 2.7 2 6 2s6-.9 6-2v-6" /><path d="M12 10v9" /></Icon>;
}
function ScaleIcon({ className }: { className?: string }) {
  return <Icon className={className}><path d="M12 3v18" /><path d="M5 7H3l4 10H3" /><path d="M19 7h2l-4 10h4" /><path d="M5 21h14" /></Icon>;
}
function WalletIcon({ className }: { className?: string }) {
  return <Icon className={className}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M16 13a1 1 0 1 0 2 0 1 1 0 0 0-2 0Z" /><path d="M2 10h20" /></Icon>;
}
function WristbandIcon({ className }: { className?: string }) {
  return <Icon className={className}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></Icon>;
}
function GearIcon({ className }: { className?: string }) {
  return <Icon className={className}><path d="M12 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" /><circle cx="12" cy="12" r="3" /><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" /></Icon>;
}
function CheckIcon({ className }: { className?: string }) {
  return <Icon className={className}><path d="m5 12 4 4 10-10" /></Icon>;
}
function ArrowRightIcon({ className }: { className?: string }) {
  return <Icon className={className}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
}
function PlayIcon({ className }: { className?: string }) {
  return <Icon className={className}><path d="m9 7 8 5-8 5V7Z" /></Icon>;
}

// ── Hero product dashboard visual ────────────────────────────────────────────

const HERO_PRODUCTS = [
  { abbr: "RL", name: "Report Lab", status: "live" as const },
  { abbr: "SP", name: "Smart Pages", status: "live" as const },
  { abbr: "SC", name: "School Connect", status: "live" as const },
  { abbr: "LS", name: "Legal Smart Pages", status: "demo" as const },
  { abbr: "KW", name: "Kids Wallet", status: "soon" as const },
  { abbr: "NF", name: "NFC Wristbands", status: "soon" as const },
];

function HeroDashboardVisual() {
  return (
    <div className="relative">
      {/* Glow blobs */}
      <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full blur-3xl opacity-30" style={{ background: "#0F5BD8" }} />
      <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full blur-2xl opacity-20" style={{ background: "#0B2F6B" }} />

      {/* Browser chrome */}
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl"
        style={{ border: "1px solid #D8E2F0" }}
      >
        {/* Title bar */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ background: "#0B2F6B" }}>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#F87171" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#FBBF24" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#34D399" }} />
          </div>
          <div
            className="flex-1 rounded-md px-3 py-1 text-[11px] font-medium"
            style={{ background: "rgba(255,255,255,0.1)", color: "#93C5FD" }}
          >
            app.ssamenj.com
          </div>
        </div>

        {/* App sub-header */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b"
          style={{ background: "white", borderColor: "#EAF3FF" }}
        >
          <div>
            <div className="text-xs font-bold" style={{ color: "#0B2F6B" }}>SSAMENJ Products</div>
            <div className="text-[10px]" style={{ color: "#6B7280" }}>6 digital systems</div>
          </div>
          <div
            className="text-[10px] font-semibold px-2 py-1 rounded-full"
            style={{ background: "#EAF3FF", color: "#0F5BD8" }}
          >
            All Institutions
          </div>
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-2 gap-2.5 p-3" style={{ background: "#F8FBFF" }}>
          {HERO_PRODUCTS.map((p) => {
            const isLive = p.status === "live";
            const isDemo = p.status === "demo";
            return (
              <div
                key={p.abbr}
                className="rounded-xl p-3 border"
                style={{ background: "white", borderColor: "#EAF3FF" }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black"
                    style={{
                      background: isLive ? "#EAF3FF" : isDemo ? "#DBEAFE" : "#F1F5F9",
                      color: isLive ? "#0F5BD8" : isDemo ? "#2563EB" : "#9CA3AF",
                    }}
                  >
                    {p.abbr}
                  </div>
                  <div
                    className="w-2 h-2 rounded-full mt-1"
                    style={{ background: isLive ? "#10B981" : isDemo ? "#0F5BD8" : "#CBD5E1" }}
                  />
                </div>
                <div className="text-[11px] font-semibold leading-snug" style={{ color: "#111827" }}>
                  {p.name}
                </div>
                <div
                  className="mt-1 text-[9px] font-semibold"
                  style={{ color: isLive ? "#10B981" : isDemo ? "#0F5BD8" : "#9CA3AF" }}
                >
                  {isLive ? "● Live" : isDemo ? "● Demo Available" : "○ Coming Soon"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Products section ─────────────────────────────────────────────────────────

type Status = "live" | "demo" | "development" | "soon";

interface Product {
  name: string;
  description: string;
  status: Status;
  icon: React.ReactNode;
  cta: string;
  ctaHref: string;
}

const PRODUCTS: Product[] = [
  {
    name: "School Connect Report Lab",
    description:
      "Generate professional student reports from marksheets, review results, approve reports, and share them securely with parents.",
    status: "live",
    icon: <ReportIcon className="w-6 h-6" />,
    cta: "View Demo",
    ctaHref: "/demos",
  },
  {
    name: "Smart Pages",
    description:
      "Upload school or office documents and turn them into clean, editable, organized digital pages accessible to your team.",
    status: "live",
    icon: <PagesIcon className="w-6 h-6" />,
    cta: "View Demo",
    ctaHref: "/demos",
  },
  {
    name: "School Connect Operations",
    description:
      "Manage student records, attendance, notices, digital IDs, wallets, and school workflows in one connected platform.",
    status: "development",
    icon: <SchoolIcon className="w-6 h-6" />,
    cta: "Learn More",
    ctaHref: "/products",
  },
  {
    name: "Legal Smart Pages",
    description:
      "Smart document workflows for lawyers and legal teams — clean, draft, organize, and prepare legal documents digitally.",
    status: "demo",
    icon: <ScaleIcon className="w-6 h-6" />,
    cta: "View Demo",
    ctaHref: "/demos",
  },
  {
    name: "Kids Wallet",
    description:
      "A simple school wallet system for controlled student spending, canteen payments, and school fee management.",
    status: "soon",
    icon: <WalletIcon className="w-6 h-6" />,
    cta: "Coming Soon",
    ctaHref: "/products",
  },
  {
    name: "NFC Wristbands",
    description:
      "Smart student identification and access tools for schools — attendance, safety, gate control, and wallet use.",
    status: "soon",
    icon: <WristbandIcon className="w-6 h-6" />,
    cta: "Coming Soon",
    ctaHref: "/products",
  },
  {
    name: "Custom Digital Products",
    description:
      "Reliable digital systems for businesses and organisations with unique workflows that off-the-shelf software cannot serve.",
    status: "live",
    icon: <GearIcon className="w-6 h-6" />,
    cta: "Learn More",
    ctaHref: "/contact",
  },
];

const STATUS_META: Record<Status, { label: string; bg: string; color: string; dot: string }> = {
  live: { label: "Live", bg: "#DCFCE7", color: "#16A34A", dot: "#22C55E" },
  demo: { label: "Demo Available", bg: "#DBEAFE", color: "#1D4ED8", dot: "#3B82F6" },
  development: { label: "In Development", bg: "#FEF3C7", color: "#B45309", dot: "#F59E0B" },
  soon: { label: "Coming Soon", bg: "#F1F5F9", color: "#64748B", dot: "#CBD5E1" },
};

function StatusBadge({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ background: m.bg, color: m.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

function ProductCard({ product }: { product: Product }) {
  const isSoon = product.status === "soon";
  return (
    <div
      className="flex flex-col rounded-2xl p-6 border transition-all hover:-translate-y-1 marketing-card-motion"
      style={{ background: "white", borderColor: "#D8E2F0", boxShadow: "0 2px 8px rgba(11,47,107,0.06)" }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 flex-shrink-0"
        style={{ background: "#EAF3FF", color: "#0F5BD8" }}
      >
        {product.icon}
      </div>
      <div className="mb-2">
        <StatusBadge status={product.status} />
      </div>
      <h3 className="text-base font-bold mb-2 leading-snug" style={{ color: "#111827" }}>
        {product.name}
      </h3>
      <p className="text-sm leading-relaxed flex-1" style={{ color: "#4B5563" }}>
        {product.description}
      </p>
      <div className="mt-5">
        {isSoon ? (
          <span
            className="inline-flex items-center gap-1.5 text-sm font-semibold cursor-default"
            style={{ color: "#9CA3AF" }}
          >
            Coming Soon
          </span>
        ) : (
          <a
            href={product.ctaHref}
            className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors hover:opacity-80"
            style={{ color: "#0F5BD8" }}
          >
            {product.cta}
            <ArrowRightIcon className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
}

// ── Demos preview section ────────────────────────────────────────────────────

const DEMO_PREVIEWS = [
  {
    name: "School Connect Report Lab",
    description: "See how schools generate, review, and share professional student reports from marksheets.",
    status: "demo" as Status,
  },
  {
    name: "Smart Pages",
    description: "Watch how documents are uploaded, cleaned, and turned into organized digital pages.",
    status: "demo" as Status,
  },
  {
    name: "Legal Smart Pages",
    description: "Explore how legal teams prepare, draft, and organize legal documents digitally.",
    status: "soon" as Status,
  },
  {
    name: "School Connect Operations",
    description: "Preview the full school operations platform — students, attendance, IDs, and more.",
    status: "soon" as Status,
  },
];

function DemoPreviewCard({ demo }: { demo: (typeof DEMO_PREVIEWS)[number] }) {
  const isAvail = demo.status === "demo" || demo.status === "live";
  return (
    <div
      className="rounded-2xl p-6 border flex flex-col"
      style={{ background: "white", borderColor: "#D8E2F0", boxShadow: "0 2px 8px rgba(11,47,107,0.06)" }}
    >
      <StatusBadge status={demo.status} />
      <h3 className="mt-3 text-base font-bold leading-snug" style={{ color: "#111827" }}>
        {demo.name}
      </h3>
      <p className="mt-2 text-sm leading-relaxed flex-1" style={{ color: "#4B5563" }}>
        {demo.description}
      </p>
      <div className="mt-5">
        {isAvail ? (
          <a
            href="/demos"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all hover:opacity-90 active:scale-95"
            style={{ background: "#0F5BD8", color: "white" }}
          >
            <PlayIcon className="w-4 h-4" />
            Explore Demo
          </a>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg"
            style={{ background: "#F1F5F9", color: "#9CA3AF" }}
          >
            Preview Coming Soon
          </span>
        )}
      </div>
    </div>
  );
}

// ── Upcoming products ────────────────────────────────────────────────────────

const UPCOMING = [
  {
    name: "Kids Wallet",
    icon: <WalletIcon className="w-6 h-6" />,
    description:
      "A simple school wallet system for controlled student spending and school payments — linked to their digital ID.",
    eta: "2025",
  },
  {
    name: "NFC Wristbands",
    icon: <WristbandIcon className="w-6 h-6" />,
    description:
      "Smart student identification and access tools for schools — attendance tracking, safety, and wallet integration.",
    eta: "2025",
  },
  {
    name: "Institution Dashboards",
    icon: (
      <Icon className="w-6 h-6">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </Icon>
    ),
    description:
      "Centralized dashboards for schools, offices, and growing businesses — track everything in one place.",
    eta: "2025",
  },
];

// ── Why SSAMENJ section ──────────────────────────────────────────────────────

const WHY_POINTS = [
  { title: "Simple interfaces for everyday users", body: "Our products are designed for teachers, clerks, and administrators — not only developers." },
  { title: "Secure school and business data", body: "Data is protected per-institution with strict access controls and audit trails." },
  { title: "Practical workflows that reduce paperwork", body: "We automate repetitive tasks — report generation, marksheet entry, document prep." },
  { title: "Built for African institutions with global standards", body: "Our systems understand local workflows while meeting international software quality." },
  { title: "Flexible for schools, offices, and legal teams", body: "One platform family adaptable across different institution types and sizes." },
];

// ── How it works ─────────────────────────────────────────────────────────────

const HOW_STEPS = [
  { n: "01", title: "We understand your workflow", body: "We take time to understand how your institution currently works before proposing anything." },
  { n: "02", title: "We configure the right solution", body: "We set up the system specifically for your school, office, or legal team — no generic templates." },
  { n: "03", title: "Your team starts working faster", body: "Staff get training and support until the system becomes part of their daily routine." },
  { n: "04", title: "You manage, track, and grow digitally", body: "You stay in control with dashboards, reports, and audit tools built into the platform." },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export function SSAMENJHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      <MarketingHeader activePath="/" />

      {/* ── Hero ── */}
      <section
        className="relative pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0B2F6B 0%, #0F5BD8 60%, #1A72F0 100%)" }}
      >
        {/* Background grid */}
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left */}
            <div className="marketing-fade-up">
              {/* Eyebrow */}
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
                style={{ background: "rgba(255,255,255,0.12)", color: "#BFDBFE", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                SSAMENJ Technologies — Smart Systems
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight text-white">
                Smart Systems.{" "}
                <span style={{ color: "#93C5FD" }}>Simple Work.</span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed" style={{ color: "#BFDBFE", maxWidth: "520px" }}>
                SSAMENJ Technologies builds practical digital systems that help schools, offices, legal teams,
                and growing businesses reduce paperwork, organize work, and serve people faster.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={BOOK_DEMO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-xl shadow-lg transition-all hover:opacity-90 hover:-translate-y-px active:scale-95"
                  style={{ background: "white", color: "#0B2F6B" }}
                >
                  Book a Demo
                  <ArrowRightIcon className="w-4 h-4" />
                </a>
                <a
                  href="/demos"
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-xl transition-all hover:opacity-90"
                  style={{ background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.2)" }}
                >
                  <PlayIcon className="w-4 h-4" />
                  View Demos
                </a>
              </div>

              {/* Trust stats */}
              <div className="mt-10 flex flex-wrap gap-4">
                {[
                  { v: "3+", l: "Live Products" },
                  { v: "4+", l: "Products in Pipeline" },
                  { v: "Schools", l: "Primary Customers" },
                ].map((s) => (
                  <div
                    key={s.l}
                    className="px-4 py-2.5 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    <div className="text-lg font-black text-white leading-none">{s.v}</div>
                    <div className="text-[11px] mt-0.5 tracking-wide" style={{ color: "#93C5FD" }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Dashboard visual */}
            <div className="marketing-fade-up-delay-1 hidden sm:block">
              <HeroDashboardVisual />
            </div>
          </div>
        </div>
      </section>

      {/* ── Products ── */}
      <section id="products" className="py-16 lg:py-24" style={{ background: "white" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
              style={{ background: "#EAF3FF", color: "#0F5BD8" }}
            >
              Our Products
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ color: "#111827" }}>
              Digital Products Built for Real Institutions
            </h2>
            <p className="mt-4 text-base max-w-2xl mx-auto" style={{ color: "#4B5563" }}>
              Every SSAMENJ product is built from actual institution needs — no bloated features, no steep learning curves.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PRODUCTS.map((p) => (
              <ProductCard key={p.name} product={p} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <a
              href="/products"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all hover:opacity-90"
              style={{ background: "#EAF3FF", color: "#0F5BD8" }}
            >
              See all products in detail
              <ArrowRightIcon className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Demos preview ── */}
      <section id="demos" className="py-16 lg:py-24" style={{ background: "#EAF3FF" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
              style={{ background: "#DBEAFE", color: "#1D4ED8" }}
            >
              Live Demos
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ color: "#111827" }}>
              Explore Our Product Demos
            </h2>
            <p className="mt-4 text-base max-w-xl mx-auto" style={{ color: "#4B5563" }}>
              See our systems in action before committing to anything.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {DEMO_PREVIEWS.map((d) => (
              <DemoPreviewCard key={d.name} demo={d} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <a
              href="/demos"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl text-white shadow-md transition-all hover:opacity-90 hover:-translate-y-px"
              style={{ background: "#0F5BD8" }}
            >
              Go to Demos Hub
              <ArrowRightIcon className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Upcoming products ── */}
      <section id="upcoming" className="py-16 lg:py-24" style={{ background: "white" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
              style={{ background: "#FEF3C7", color: "#B45309" }}
            >
              Coming Soon
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ color: "#111827" }}>
              Upcoming SSAMENJ Products
            </h2>
            <p className="mt-4 text-base max-w-xl mx-auto" style={{ color: "#4B5563" }}>
              We are actively building the next generation of institution tools.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {UPCOMING.map((p) => (
              <div
                key={p.name}
                className="rounded-2xl p-6 border flex flex-col"
                style={{ background: "#FAFBFF", borderColor: "#D8E2F0", borderStyle: "dashed" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: "#EAF3FF", color: "#0F5BD8" }}
                  >
                    {p.icon}
                  </div>
                  <span
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "#F1F5F9", color: "#64748B" }}
                  >
                    Coming {p.eta}
                  </span>
                </div>
                <h3 className="text-base font-bold mb-2" style={{ color: "#111827" }}>
                  {p.name}
                </h3>
                <p className="text-sm leading-relaxed flex-1" style={{ color: "#4B5563" }}>
                  {p.description}
                </p>
                <div className="mt-5">
                  <a
                    href={BOOK_DEMO_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold transition-colors hover:opacity-70"
                    style={{ color: "#0F5BD8" }}
                  >
                    Get notified →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why SSAMENJ ── */}
      <section
        id="about"
        className="py-16 lg:py-24"
        style={{ background: "#0B2F6B" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-5"
                style={{ background: "rgba(255,255,255,0.1)", color: "#93C5FD", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                Why SSAMENJ
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
                Built for real institutions,{" "}
                <span style={{ color: "#93C5FD" }}>not just demos.</span>
              </h2>
              <p className="mt-4 text-base leading-relaxed" style={{ color: "#BFDBFE" }}>
                We build tools that actual school staff, office administrators, and legal teams can use daily — without IT support on standby.
              </p>
              <a
                href="/about"
                className="inline-flex items-center gap-2 mt-6 text-sm font-semibold transition-colors hover:opacity-80"
                style={{ color: "#93C5FD" }}
              >
                Learn about SSAMENJ
                <ArrowRightIcon className="w-4 h-4" />
              </a>
            </div>

            {/* Right — points */}
            <div className="space-y-4">
              {WHY_POINTS.map((p) => (
                <div
                  key={p.title}
                  className="flex gap-4 p-4 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "#0F5BD8" }}
                  >
                    <CheckIcon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{p.title}</div>
                    <div className="mt-0.5 text-sm leading-relaxed" style={{ color: "#93C5FD" }}>
                      {p.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-16 lg:py-24" style={{ background: "#EAF3FF" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ color: "#111827" }}>
              How It Works
            </h2>
            <p className="mt-4 text-base max-w-xl mx-auto" style={{ color: "#4B5563" }}>
              Getting started with SSAMENJ is straightforward.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_STEPS.map((step, i) => (
              <div
                key={step.n}
                className="relative rounded-2xl p-6 border"
                style={{ background: "white", borderColor: "#D8E2F0" }}
              >
                {/* Connector line (not on last) */}
                {i < HOW_STEPS.length - 1 && (
                  <div
                    className="hidden lg:block absolute top-9 left-full w-6 border-t-2 border-dashed z-10"
                    style={{ borderColor: "#D8E2F0" }}
                  />
                )}
                <div
                  className="text-2xl font-black mb-3"
                  style={{ color: "#0F5BD8", fontVariantNumeric: "tabular-nums" }}
                >
                  {step.n}
                </div>
                <h3 className="text-sm font-bold mb-2" style={{ color: "#111827" }}>
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "#4B5563" }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section
        className="py-16 lg:py-24"
        style={{ background: "linear-gradient(135deg, #0B2F6B 0%, #0F5BD8 100%)" }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Ready to simplify your work?
          </h2>
          <p className="text-base max-w-2xl mx-auto mb-8 leading-relaxed" style={{ color: "#BFDBFE" }}>
            Let SSAMENJ Technologies help your school, office, legal team, or business move from manual work to smart digital systems.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href={BOOK_DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl shadow-lg transition-all hover:opacity-90 hover:-translate-y-px"
              style={{ background: "white", color: "#0B2F6B" }}
            >
              Book a Demo
              <ArrowRightIcon className="w-4 h-4" />
            </a>
            <a
              href="/demos"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl transition-all hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              <PlayIcon className="w-4 h-4" />
              View Demos
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter />
      <FloatingWhatsAppButton />
    </div>
  );
}
