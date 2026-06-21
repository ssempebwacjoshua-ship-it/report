import { MarketingHeader } from "../components/marketing/MarketingHeader";
import { MarketingFooter } from "../components/marketing/MarketingFooter";
import { FloatingWhatsAppButton } from "../components/marketing/FloatingWhatsAppButton";
import { buildWhatsAppUrl } from "../config/contact";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I'd like to book a product demo for my organisation.",
);

// ── Icons ─────────────────────────────────────────────────────────────────────

function Icon({ children, className = "w-6 h-6" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}
function ReportIcon({ c }: { c?: string }) {
  return <Icon className={c}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></Icon>;
}
function PagesIcon({ c }: { c?: string }) {
  return <Icon className={c}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></Icon>;
}
function SchoolIcon({ c }: { c?: string }) {
  return <Icon className={c}><path d="M3 10 12 4l9 6-9 6-9-6Z" /><path d="M6 11v6c0 1.1 2.7 2 6 2s6-.9 6-2v-6" /><path d="M12 10v9" /></Icon>;
}
function ScaleIcon({ c }: { c?: string }) {
  return <Icon className={c}><path d="M12 3v18" /><path d="M5 7 2 17h6M19 7l3 10h-6M5 21h14" /></Icon>;
}
function WalletIcon({ c }: { c?: string }) {
  return <Icon className={c}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M16 13a1 1 0 1 0 2 0 1 1 0 0 0-2 0ZM2 10h20" /></Icon>;
}
function WristbandIcon({ c }: { c?: string }) {
  return <Icon className={c}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></Icon>;
}
function GearIcon({ c }: { c?: string }) {
  return <Icon className={c}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" /></Icon>;
}
function CheckIcon({ c }: { c?: string }) {
  return <Icon className={c}><path d="m5 12 4 4 10-10" /></Icon>;
}
function ArrowRightIcon({ c }: { c?: string }) {
  return <Icon className={c}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
}

// ── Product data ──────────────────────────────────────────────────────────────

type Status = "live" | "demo" | "development" | "soon";

interface Product {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: React.ReactNode;
  iconBig: React.ReactNode;
  status: Status;
  audience: string[];
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  accentColor: string;
  accentBg: string;
}

const PRODUCTS: Product[] = [
  {
    id: "report-lab",
    name: "School Connect Report Lab",
    tagline: "Professional student reports from marksheets.",
    description:
      "Report Lab transforms raw marksheet data into polished, professional student report cards. Teachers enter marks, administrators review, approve and release — parents receive secure links. No printing bottlenecks, no manual formatting.",
    icon: <ReportIcon c="w-6 h-6" />,
    iconBig: <ReportIcon c="w-8 h-8" />,
    status: "live",
    audience: ["Schools", "Teachers", "Parents", "Administrators"],
    features: [
      "Mark entry from subject teachers",
      "Automatic grade and position calculation",
      "Class teacher and head teacher comments",
      "One-click report generation for whole class",
      "Secure parent-facing report links",
      "Batch release to parents",
    ],
    ctaLabel: "Open Demo",
    ctaHref: "/dem",
    secondaryLabel: "Book walkthrough",
    secondaryHref: BOOK_DEMO_URL,
    accentColor: "#0F5BD8",
    accentBg: "#EAF3FF",
  },
  {
    id: "smart-pages",
    name: "Smart Pages",
    tagline: "Turn documents into clean, digital, organized pages.",
    description:
      "Smart Pages lets schools and offices upload raw documents — handbooks, policies, notices, forms — and convert them into structured, searchable, shareable digital pages. Ideal for teams that want consistent, clean documents without manual reformatting.",
    icon: <PagesIcon c="w-6 h-6" />,
    iconBig: <PagesIcon c="w-8 h-8" />,
    status: "live",
    audience: ["Schools", "Offices", "Legal Teams", "Businesses"],
    features: [
      "Upload PDF or Word documents",
      "AI-assisted cleaning and structure",
      "Editable digital page output",
      "Shareable via secure link",
      "Collections for organized document sets",
      "Role-based access and permissions",
    ],
    ctaLabel: "View Demo",
    ctaHref: "/demos",
    secondaryLabel: "Book walkthrough",
    secondaryHref: BOOK_DEMO_URL,
    accentColor: "#0F5BD8",
    accentBg: "#EAF3FF",
  },
  {
    id: "school-connect-ops",
    name: "School Connect Operations",
    tagline: "One connected platform for your entire school.",
    description:
      "School Connect Operations is a comprehensive school management platform — student records, attendance tracking, digital ID cards, school notices, wallets, and administrative workflows all connected in one system built around the school day.",
    icon: <SchoolIcon c="w-6 h-6" />,
    iconBig: <SchoolIcon c="w-8 h-8" />,
    status: "development",
    audience: ["Schools", "Administrators", "Teachers", "Support Staff"],
    features: [
      "Student enrolment and records",
      "Daily attendance tracking (manual and NFC)",
      "Digital student ID cards",
      "School notice board and parent communication",
      "Student wallet for school payments",
      "Academic year and term management",
    ],
    ctaLabel: "Get Notified",
    ctaHref: BOOK_DEMO_URL,
    accentColor: "#B45309",
    accentBg: "#FEF3C7",
  },
  {
    id: "legal-smart-pages",
    name: "Legal Smart Pages",
    tagline: "Smart document workflows for legal teams.",
    description:
      "Legal Smart Pages brings the Smart Pages engine to law firms and legal departments. Clean messy legal drafts, organize case documents, prepare filing-ready documents, and collaborate securely — all without sending documents by email or printing stacks of paper.",
    icon: <ScaleIcon c="w-6 h-6" />,
    iconBig: <ScaleIcon c="w-8 h-8" />,
    status: "demo",
    audience: ["Lawyers", "Law Firms", "Legal Departments", "Paralegals"],
    features: [
      "Legal document cleaning and formatting",
      "Case and matter-based document collections",
      "Client-safe document sharing",
      "Draft and final version tracking",
      "Team collaboration on live documents",
      "Secure access controls per case",
    ],
    ctaLabel: "Explore Demo",
    ctaHref: "/demos",
    secondaryLabel: "Book walkthrough",
    secondaryHref: BOOK_DEMO_URL,
    accentColor: "#7C3AED",
    accentBg: "#F5F3FF",
  },
  {
    id: "kids-wallet",
    name: "Kids Wallet",
    tagline: "Controlled school spending, safe and simple.",
    description:
      "Kids Wallet gives parents full control over what their child spends at school — linked to the canteen, school fees, and activities via digital ID or NFC wristband. Schools get a cleaner payment flow; parents get peace of mind.",
    icon: <WalletIcon c="w-6 h-6" />,
    iconBig: <WalletIcon c="w-8 h-8" />,
    status: "soon",
    audience: ["Schools", "Parents", "Canteen Staff", "Finance Teams"],
    features: [
      "Parent-funded digital wallet per student",
      "Canteen and activity spending controls",
      "Spend limits and category restrictions",
      "Real-time parent notifications",
      "Linked to digital ID or NFC wristband",
      "School cashless payment system",
    ],
    ctaLabel: "Get Notified",
    ctaHref: BOOK_DEMO_URL,
    accentColor: "#0F5BD8",
    accentBg: "#EAF3FF",
  },
  {
    id: "nfc-wristbands",
    name: "NFC Wristbands",
    tagline: "Smart student access, attendance, and identity.",
    description:
      "NFC Wristbands give every student a neutral smart token that works at gates, canteen counters, attendance checkpoints, and wallet terminals. One tap identifies the student and triggers the appropriate action — no phones, no cards, no lost IDs.",
    icon: <WristbandIcon c="w-6 h-6" />,
    iconBig: <WristbandIcon c="w-8 h-8" />,
    status: "soon",
    audience: ["Schools", "Security Staff", "Canteen Staff", "Administration"],
    features: [
      "Neutral NFC token on each wristband",
      "Gate access control and audit log",
      "Attendance tap-in and tap-out",
      "Canteen payment via wristband tap",
      "Lost/stolen wristband deactivation",
      "Role-based scan routing by staff device",
    ],
    ctaLabel: "Get Notified",
    ctaHref: BOOK_DEMO_URL,
    accentColor: "#0F5BD8",
    accentBg: "#EAF3FF",
  },
  {
    id: "custom",
    name: "Custom Digital Products",
    tagline: "Built around your specific workflow.",
    description:
      "When off-the-shelf software doesn't fit, SSAMENJ designs and builds custom digital systems tailored to your organisation's actual processes. We work with businesses, government bodies, NGOs, and institutions with unique operational requirements.",
    icon: <GearIcon c="w-6 h-6" />,
    iconBig: <GearIcon c="w-8 h-8" />,
    status: "live",
    audience: ["Businesses", "NGOs", "Government", "Unique Institutions"],
    features: [
      "Discovery and workflow mapping",
      "Purpose-built system architecture",
      "Mobile-friendly user interfaces",
      "Secure data management",
      "Ongoing support and maintenance",
      "Integration with existing tools",
    ],
    ctaLabel: "Get in Touch",
    ctaHref: "/contact",
    accentColor: "#0F5BD8",
    accentBg: "#EAF3FF",
  },
];

const STATUS_META: Record<Status, { label: string; bg: string; color: string; dot: string }> = {
  live:        { label: "Live", bg: "#DCFCE7", color: "#16A34A", dot: "#22C55E" },
  demo:        { label: "Demo Available", bg: "#DBEAFE", color: "#1D4ED8", dot: "#3B82F6" },
  development: { label: "In Development", bg: "#FEF3C7", color: "#B45309", dot: "#F59E0B" },
  soon:        { label: "Coming Soon", bg: "#F1F5F9", color: "#64748B", dot: "#CBD5E1" },
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

// ── Product detail card ───────────────────────────────────────────────────────

function ProductCard({ product, index }: { product: Product; index: number }) {
  const isEven = index % 2 === 0;
  const isSoon = product.status === "soon";

  return (
    <article
      className="rounded-3xl overflow-hidden border"
      style={{ borderColor: "#D8E2F0", boxShadow: "0 4px 20px rgba(11,47,107,0.06)" }}
    >
      <div className={`grid grid-cols-1 lg:grid-cols-2 ${isEven ? "" : "lg:[direction:rtl]"}`}>
        {/* Left: info */}
        <div className={`flex flex-col p-8 lg:p-10 bg-white ${isEven ? "" : "lg:[direction:ltr]"}`}>
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: product.accentBg, color: product.accentColor }}
            >
              {product.iconBig}
            </div>
            <StatusBadge status={product.status} />
          </div>

          <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: product.accentColor }}>
            {product.tagline}
          </p>
          <h2 className="text-2xl font-extrabold leading-snug mb-4" style={{ color: "#111827" }}>
            {product.name}
          </h2>
          <p className="text-sm leading-relaxed mb-6" style={{ color: "#4B5563" }}>
            {product.description}
          </p>

          {/* Audience */}
          <div className="flex flex-wrap gap-1.5 mb-6">
            {product.audience.map((a) => (
              <span
                key={a}
                className="px-2.5 py-1 text-[11px] font-medium rounded-full"
                style={{ background: "#EAF3FF", color: "#0F5BD8" }}
              >
                {a}
              </span>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3 mt-auto">
            {isSoon ? (
              <a
                href={product.ctaHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl text-white transition-all hover:opacity-90"
                style={{ background: "#0F5BD8" }}
              >
                Get Notified
                <ArrowRightIcon c="w-4 h-4" />
              </a>
            ) : (
              <a
                href={product.ctaHref}
                {...(product.ctaHref.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl text-white transition-all hover:opacity-90"
                style={{ background: "#0F5BD8" }}
              >
                {product.ctaLabel}
                <ArrowRightIcon c="w-4 h-4" />
              </a>
            )}
            {product.secondaryLabel && product.secondaryHref && (
              <a
                href={product.secondaryHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border transition-all hover:bg-[#EAF3FF]"
                style={{ color: "#0F5BD8", borderColor: "#D8E2F0" }}
              >
                {product.secondaryLabel}
              </a>
            )}
          </div>
        </div>

        {/* Right: features */}
        <div
          className={`flex flex-col p-8 lg:p-10 ${isEven ? "" : "lg:[direction:ltr]"}`}
          style={{ background: "#F8FBFF", borderLeft: isEven ? `1px solid #D8E2F0` : "none", borderRight: !isEven ? "1px solid #D8E2F0" : "none" }}
        >
          <h3 className="text-xs font-bold uppercase tracking-wider mb-5" style={{ color: "#0B2F6B" }}>
            Key Features
          </h3>
          <ul className="space-y-3">
            {product.features.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: product.accentBg }}
                >
                  <CheckIcon c="w-3 h-3" />
                </span>
                <span className="text-sm leading-snug" style={{ color: "#374151" }}>{f}</span>
              </li>
            ))}
          </ul>

          {/* "Coming soon" shimmer overlay for not-live products */}
          {isSoon && (
            <div
              className="mt-6 p-4 rounded-xl text-sm font-medium"
              style={{ background: "#FEF3C7", color: "#B45309", border: "1px solid #FDE68A" }}
            >
              🚧 This product is currently in development. Book a demo to get early access and provide input.
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ProductsPage() {
  const liveCount = PRODUCTS.filter((p) => p.status === "live" || p.status === "demo").length;
  const upcomingCount = PRODUCTS.filter((p) => p.status === "soon" || p.status === "development").length;

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      <MarketingHeader activePath="/products" />

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
            SSAMENJ Technologies — Product Suite
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight">
            Digital Products Built for{" "}
            <span style={{ color: "#93C5FD" }}>Real Institutions</span>
          </h1>
          <p className="mt-5 text-base max-w-2xl mx-auto leading-relaxed" style={{ color: "#BFDBFE" }}>
            Every SSAMENJ product is built around an actual institution problem — not a hypothetical use case. Simple to use, secure by design, and practical from day one.
          </p>

          {/* Quick stats */}
          <div className="mt-8 inline-flex items-center gap-6 px-6 py-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <div className="text-center">
              <div className="text-2xl font-black text-white">{liveCount}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "#93C5FD" }}>Live / Demo</div>
            </div>
            <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.15)" }} />
            <div className="text-center">
              <div className="text-2xl font-black text-white">{upcomingCount}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "#93C5FD" }}>In Pipeline</div>
            </div>
            <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.15)" }} />
            <div className="text-center">
              <div className="text-2xl font-black text-white">7</div>
              <div className="text-[11px] mt-0.5" style={{ color: "#93C5FD" }}>Total Products</div>
            </div>
          </div>

          {/* Jump nav */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {PRODUCTS.map((p) => (
              <a
                key={p.id}
                href={`#${p.id}`}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:opacity-90"
                style={{ background: "rgba(255,255,255,0.1)", color: "#BFDBFE", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                {p.name.split(" ").slice(0, 2).join(" ")}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Products list ── */}
      <section className="py-14 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {PRODUCTS.map((product, i) => (
            <div key={product.id} id={product.id}>
              <ProductCard product={product} index={i} />
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-14 lg:py-20" style={{ background: "#EAF3FF" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3" style={{ color: "#111827" }}>
            Not sure which product fits your needs?
          </h2>
          <p className="text-base mb-8 leading-relaxed" style={{ color: "#4B5563" }}>
            Our team will help you find the right solution for your school, office, or organisation. Book a free consultation — no commitment needed.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href={BOOK_DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl text-white shadow-md transition-all hover:opacity-90 hover:-translate-y-px"
              style={{ background: "#0B2F6B" }}
            >
              Book a Consultation
              <ArrowRightIcon c="w-4 h-4" />
            </a>
            <a
              href="/demos"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl border transition-all hover:bg-white"
              style={{ color: "#0B2F6B", borderColor: "#D8E2F0", background: "white" }}
            >
              Explore Demos First
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter />
      <FloatingWhatsAppButton />
    </div>
  );
}
