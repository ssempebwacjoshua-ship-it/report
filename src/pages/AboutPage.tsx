import { MarketingHeader } from "../components/marketing/MarketingHeader";
import { MarketingFooter } from "../components/marketing/MarketingFooter";
import { FloatingWhatsAppButton } from "../components/marketing/FloatingWhatsAppButton";
import { buildWhatsAppUrl } from "../config/contact";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I'd like to learn more about your products and book a demo.",
);

function Icon({ children, className = "w-6 h-6" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}
function CheckIcon({ c = "w-4 h-4" }: { c?: string }) {
  return <Icon className={c}><path d="m5 12 4 4 10-10" /></Icon>;
}
function ArrowRightIcon({ c = "w-4 h-4" }: { c?: string }) {
  return <Icon className={c}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
}
function LightbulbIcon({ c = "w-6 h-6" }: { c?: string }) {
  return <Icon className={c}><path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7Z" /></Icon>;
}
function UsersIcon({ c = "w-6 h-6" }: { c?: string }) {
  return <Icon className={c}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Icon>;
}
function GlobeIcon({ c = "w-6 h-6" }: { c?: string }) {
  return <Icon className={c}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2Z" /></Icon>;
}
function ShieldIcon({ c = "w-6 h-6" }: { c?: string }) {
  return <Icon className={c}><path d="M12 3 5 6v5c0 4.9 3.4 8.8 7 10 3.6-1.2 7-5.1 7-10V6l-7-3Z" /></Icon>;
}
function BuildingIcon({ c = "w-6 h-6" }: { c?: string }) {
  return <Icon className={c}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></Icon>;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const VALUES = [
  {
    icon: <LightbulbIcon c="w-6 h-6" />,
    title: "Practical over complex",
    body: "We solve real problems first. No feature added unless a real institution needs it.",
  },
  {
    icon: <UsersIcon c="w-6 h-6" />,
    title: "Built for everyday users",
    body: "Our products are designed for teachers, clerks, and front-line staff — not IT professionals.",
  },
  {
    icon: <ShieldIcon c="w-6 h-6" />,
    title: "Security and trust",
    body: "Every institution's data is isolated, protected, and auditable. We take data responsibility seriously.",
  },
  {
    icon: <GlobeIcon c="w-6 h-6" />,
    title: "African-rooted, globally professional",
    body: "We understand local institutional realities while building to international software standards.",
  },
  {
    icon: <BuildingIcon c="w-6 h-6" />,
    title: "Long-term partnerships",
    body: "We don't just ship software. We support our clients through setup, training, and ongoing growth.",
  },
];

const SECTORS = [
  { name: "Schools", desc: "Primary, secondary, and tertiary institutions across Uganda and East Africa." },
  { name: "Law Firms & Legal Departments", desc: "Legal practices that need cleaner, safer, and faster document workflows." },
  { name: "Offices & Businesses", desc: "Growing businesses and organisations that need structure and digital systems." },
  { name: "NGOs & Government Bodies", desc: "Institutions with unique workflows requiring custom digital solutions." },
];

const MILESTONES = [
  { year: "2023", event: "SSAMENJ Technologies founded with a focus on school report systems." },
  { year: "2024", event: "School Connect Report Lab launched. First schools go live." },
  { year: "2024", event: "Smart Pages launched. Schools and offices begin digital document management." },
  { year: "2024", event: "Legal Smart Pages enters development for legal teams." },
  { year: "2025", event: "School Connect Operations platform in active development." },
  { year: "2025", event: "NFC Wristbands and Kids Wallet announced for school operations." },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export function AboutPage() {
  return (
    <div className="min-h-screen" style={{ background: "white" }}>
      <MarketingHeader activePath="/about" />

      {/* ── Hero ── */}
      <section
        className="relative pt-24 pb-14 lg:pt-32 lg:pb-20 overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0B2F6B 0%, #0F5BD8 60%, #1A72F0 100%)" }}
      >
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
            style={{ background: "rgba(255,255,255,0.12)", color: "#BFDBFE", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            About SSAMENJ Technologies
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight max-w-3xl">
            We build digital systems that{" "}
            <span style={{ color: "#93C5FD" }}>institutions can actually use.</span>
          </h1>
          <p className="mt-6 text-base max-w-2xl leading-relaxed" style={{ color: "#BFDBFE" }}>
            SSAMENJ Technologies is a software company focused on building practical digital tools for schools, offices, legal teams, and growing businesses — with a deep understanding of how African institutions actually operate.
          </p>
        </div>
      </section>

      {/* ── Mission + story ── */}
      <section className="py-14 lg:py-20" style={{ background: "white" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Story */}
            <div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-5"
                style={{ background: "#EAF3FF", color: "#0F5BD8" }}
              >
                Our Story
              </div>
              <h2 className="text-3xl font-extrabold mb-5 leading-snug" style={{ color: "#111827" }}>
                Started with a real problem in a real school.
              </h2>
              <div className="space-y-4 text-sm leading-relaxed" style={{ color: "#4B5563" }}>
                <p>
                  SSAMENJ Technologies was founded with a simple observation: institutions across Africa were doing critical work — educating students, running legal practices, managing organisations — with manual processes that wasted enormous amounts of time and introduced unnecessary errors.
                </p>
                <p>
                  We started with school reports. Teachers spending hours manually filling in report cards, headteachers signing stacks of papers, parents waiting weeks for results that could be shared in seconds. School Connect Report Lab was built to fix exactly that.
                </p>
                <p>
                  From there we expanded into document management with Smart Pages, then legal workflows with Legal Smart Pages. Each product grew from a direct conversation with people who were frustrated by the gap between how their institution needed to work and how modern software expected them to work.
                </p>
                <p>
                  Today, SSAMENJ builds a suite of connected products under one company identity — with a long-term commitment to building software that African institutions are proud to use.
                </p>
              </div>
            </div>

            {/* Mission card */}
            <div className="space-y-5">
              <div
                className="rounded-2xl p-7 border"
                style={{ background: "#EAF3FF", borderColor: "#D8E2F0" }}
              >
                <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#0F5BD8" }}>
                  Our Mission
                </div>
                <p className="text-lg font-bold leading-snug" style={{ color: "#0B2F6B" }}>
                  To give every institution — regardless of size or location — access to digital systems that actually fit how they work.
                </p>
              </div>

              <div
                className="rounded-2xl p-7 border"
                style={{ background: "#0B2F6B", borderColor: "#0B2F6B" }}
              >
                <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#93C5FD" }}>
                  Our Slogan
                </div>
                <p className="text-2xl font-extrabold text-white">Smart Systems. Simple Work.</p>
                <p className="mt-2 text-sm" style={{ color: "#93C5FD" }}>
                  Every product decision is measured against this — does it make work simpler for the people using it?
                </p>
              </div>

              {/* Sectors */}
              <div
                className="rounded-2xl p-7 border"
                style={{ background: "white", borderColor: "#D8E2F0" }}
              >
                <div className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "#0B2F6B" }}>
                  Who We Serve
                </div>
                <ul className="space-y-3">
                  {SECTORS.map((s) => (
                    <li key={s.name} className="flex gap-3 items-start">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: "#EAF3FF" }}
                      >
                        <CheckIcon c="w-3 h-3 text-[#0F5BD8]" />
                      </span>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: "#111827" }}>{s.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{s.desc}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="py-14 lg:py-20" style={{ background: "#EAF3FF" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
              style={{ background: "white", color: "#0F5BD8" }}
            >
              Our Values
            </div>
            <h2 className="text-3xl font-extrabold" style={{ color: "#111827" }}>
              What we believe in
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {VALUES.map((v, i) => (
              <div
                key={v.title}
                className="rounded-2xl p-6 border"
                style={{ background: "white", borderColor: "#D8E2F0", boxShadow: "0 2px 8px rgba(11,47,107,0.05)" }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "#EAF3FF", color: "#0F5BD8" }}
                >
                  {v.icon}
                </div>
                <div className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: "#D8E2F0" }}>
                  0{i + 1}
                </div>
                <h3 className="text-base font-bold mb-2" style={{ color: "#111827" }}>{v.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#4B5563" }}>{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Timeline ── */}
      <section className="py-14 lg:py-20" style={{ background: "white" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold" style={{ color: "#111827" }}>
              Our journey so far
            </h2>
          </div>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-px" style={{ background: "#D8E2F0" }} />
            <div className="space-y-6">
              {MILESTONES.map((m, i) => (
                <div key={i} className="flex gap-5 items-start">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 text-xs font-black"
                    style={{ background: "#0F5BD8", color: "white", border: "3px solid white", boxShadow: "0 0 0 2px #D8E2F0" }}
                  >
                    {m.year.slice(2)}
                  </div>
                  <div className="pt-2 flex-1">
                    <div className="text-xs font-bold mb-0.5" style={{ color: "#0F5BD8" }}>{m.year}</div>
                    <p className="text-sm leading-relaxed" style={{ color: "#374151" }}>{m.event}</p>
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
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
            Ready to work with SSAMENJ?
          </h2>
          <p className="text-base mb-8 max-w-xl mx-auto leading-relaxed" style={{ color: "#BFDBFE" }}>
            Whether you want to see a demo, get a custom quote, or just ask a question — we're here. Let's talk about what your institution needs.
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
              <ArrowRightIcon c="w-4 h-4" />
            </a>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl transition-all hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              Contact Us
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter />
      <FloatingWhatsAppButton />
    </div>
  );
}
