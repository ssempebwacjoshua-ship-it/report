import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { TestimonialsSection } from "../components/marketing/TestimonialsSection";
import {
  CashIcon,
  FileTextIcon,
  GridIcon,
  LockIcon,
  MarketIcon,
  SchoolIcon,
  ShieldIcon,
  SmartphoneIcon,
  SparklesIcon,
} from "../components/marketing/Icons";

type SuiteStatus = "live" | "demo" | "soon";

const SUITE_ITEMS: { abbr: string; name: string; icon: ReactNode; status: SuiteStatus }[] = [
  { abbr: "RL", name: "Report Lab", icon: <FileTextIcon className="w-4 h-4" />, status: "live" },
  { abbr: "SP", name: "Smart Pages", icon: <GridIcon className="w-4 h-4" />, status: "live" },
  { abbr: "SC", name: "School Connect", icon: <SchoolIcon className="w-4 h-4" />, status: "live" },
  { abbr: "LS", name: "Legal Smart Pages", icon: <ShieldIcon className="w-4 h-4" />, status: "demo" },
  { abbr: "PM", name: "PearlMart", icon: <MarketIcon className="w-4 h-4" />, status: "demo" },
  { abbr: "WC", name: "Wideh Cash", icon: <CashIcon className="w-4 h-4" />, status: "demo" },
  { abbr: "KW", name: "Kids Wallet", icon: <SmartphoneIcon className="w-4 h-4" />, status: "live" },
  { abbr: "NF", name: "NFC Bands", icon: <LockIcon className="w-4 h-4" />, status: "live" },
];

interface BuildCard {
  name: string;
  tagline: string;
  href: string;
  status: SuiteStatus;
}

const BUILD_CARDS: BuildCard[] = [
  { name: "Report Lab", tagline: "Professional student reports from marksheets.", href: "/report-lab", status: "live" },
  { name: "Smart Pages", tagline: "Documents turned into clean, shareable digital pages.", href: "/smart-pages", status: "live" },
  { name: "School Connect", tagline: "One connected platform for your entire school.", href: "/products#school-connect", status: "live" },
  { name: "Legal Smart Pages", tagline: "Smart document workflows for legal teams.", href: "/products#legal-smart-pages", status: "demo" },
  { name: "PearlMart", tagline: "Marketplace & digital commerce platform.", href: "/products#pearlmart", status: "demo" },
  { name: "Wideh Cash", tagline: "Money logistics platform.", href: "/products#wideh-cash", status: "demo" },
  { name: "Kids Wallet", tagline: "Controlled school spending, safe and simple.", href: "/products#kids-wallet", status: "live" },
  { name: "NFC Bands", tagline: "Smart student access, attendance, and identity.", href: "/products#nfc-bands", status: "live" },
  { name: "Custom Digital Products", tagline: "Built around your specific workflow.", href: "/contact", status: "live" },
];

const STATUS_META: Record<SuiteStatus, { dot: string; text: string; textColor: string }> = {
  live: { dot: "#22C55E", text: "Live", textColor: "#16A34A" },
  demo: { dot: "#3B82F6", text: "Demo Available", textColor: "#1D4ED8" },
  soon: { dot: "#94A3B8", text: "Coming Soon", textColor: "#64748B" },
};

function HeroSuiteVisual() {
  return (
    <div
      className="motion-media floating-media soft-glow overflow-hidden rounded-[1.5rem] border border-white/25 marketing-card-motion"
      style={{
        background: "linear-gradient(135deg, rgba(18,92,205,0.48) 0%, rgba(9,44,112,0.38) 100%)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between border-b px-3.5 py-2.5"
        style={{ borderColor: "rgba(255,255,255,0.12)" }}
      >
        <div className="flex items-center gap-2">
          <div className="grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-blue-500 to-blue-600 text-[9px] font-extrabold text-white">
            S
          </div>
          <div>
            <div className="text-[11px] font-extrabold leading-none text-white">SSAMENJ Suite</div>
            <div className="mt-0.5 text-[9px] leading-none text-blue-200">{SUITE_ITEMS.length} digital products</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          <span className="text-[9px] font-semibold text-green-300">5 Live</span>
        </div>
      </div>

      {/* Compact horizontal cards — 2 columns */}
      <div className="grid grid-cols-2 gap-2 p-3">
        {SUITE_ITEMS.map((item) => {
          const meta = STATUS_META[item.status];
          const isLive = item.status === "live";
          const isDemo = item.status === "demo";
          return (
            <div
              key={item.abbr}
              className="flex items-center gap-2 rounded-xl border px-2.5 py-2"
              style={{
                background: isLive ? "rgba(255,255,255,0.13)" : isDemo ? "rgba(120,130,255,0.18)" : "rgba(255,255,255,0.07)",
                borderColor: isLive ? "rgba(255,255,255,0.22)" : isDemo ? "rgba(150,160,255,0.30)" : "rgba(255,255,255,0.12)",
              }}
            >
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: "rgba(255,255,255,0.18)",
                  color: isLive ? "#BAD8FF" : isDemo ? "#C4CAFF" : "#B0BEC5",
                }}
              >
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[10px] font-bold leading-tight text-white">{item.name}</div>
                <div className="mt-0.5 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.dot }} />
                  <span className="text-[9px] font-semibold" style={{ color: isLive ? "#86EFAC" : isDemo ? "#A5B4FC" : "#94A3B8" }}>{meta.text}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Panel footer */}
      <div
        className="flex items-center justify-between border-t px-3.5 py-2 text-[9px] font-semibold"
        style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.55)" }}
      >
        <span>Smart Systems. Simple Work.</span>
        <span style={{ color: "#93C5FD" }}>ssamenj.com</span>
      </div>
    </div>
  );
}

function BuildCardItem({ card }: { card: BuildCard }) {
  const meta = STATUS_META[card.status];
  return (
    <a
      href={card.href}
      className="motion-card motion-card-stagger group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-200"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-extrabold text-slate-950">{card.name}</h3>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
          <span className="text-[10px] font-semibold" style={{ color: meta.textColor }}>
            {meta.text}
          </span>
        </div>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-slate-600">{card.tagline}</p>
    </a>
  );
}

export function AboutPage() {
  return (
    <div className="bg-slate-50 text-slate-950">
      <section className="home-hero-image-bg site-hero-compact hero-rhythm border-b text-white" style={{ borderColor: "rgba(15,91,216,0.3)" }}>
        <div className="absolute inset-0 bg-dot-grid opacity-[0.12]" />
        <div className="home-hero-content mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-12 lg:items-center lg:px-8">
          <div className="lg:col-span-6">
            <div className="marketing-fade-up inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-50">
              <SparklesIcon className="h-3.5 w-3.5" />
              About SSAMENJ Technologies
            </div>
            <h1 className="marketing-fade-up-delay-1 mt-3 hero-title font-black text-white">
              We build practical digital systems for real institutions.
            </h1>
            <p className="marketing-fade-up-delay-2 mt-3 max-w-xl text-sm leading-6 text-blue-100">
              SSAMENJ Technologies designs and ships digital products for schools, legal teams, and growing organisations. Each product is shaped around real workflows, not generic templates.
            </p>
            <div className="marketing-fade-up-delay-3 mt-4 flex flex-col gap-2 sm:flex-row">
              <Link
                to="/products"
                className="btn marketing-button-motion motion-cta rounded-xl bg-white px-4 py-2.5 text-sm font-black text-blue-700 hover:bg-blue-50"
              >
                View Products
              </Link>
              <Link
                to="/demos"
                className="btn marketing-button-motion motion-cta rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15"
              >
                View Demos
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-center backdrop-blur">
                <p className="text-lg font-black text-white">{BUILD_CARDS.length}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-blue-100">Products</p>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-center backdrop-blur">
                <p className="text-lg font-black text-white">3+</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-blue-100">Live Now</p>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-center backdrop-blur">
                <p className="text-lg font-black text-white">4+</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-blue-100">In Pipeline</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <HeroSuiteVisual />
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Who We Are</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">A focused product team with a clear brief.</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                SSAMENJ Technologies was built to close a visible gap — schools, legal offices, and growing businesses in East Africa and beyond were still running critical workflows on paper, WhatsApp, or spreadsheets that were never designed for the task. We build digital alternatives that are fast to adopt, easy to explain, and structured around the actual work.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-blue-200 bg-white p-3.5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">School systems</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">Report Lab, School Connect, NFC Bands, and Kids Wallet are designed around real school operations.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Document systems</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">Smart Pages and Legal Smart Pages focus on clean document extraction, publishing, and structured workflows.</p>
              </div>
              <div className="marketing-soft-float rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Custom builds</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">When a workflow is specific, we build around the problem instead of forcing a generic tool.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Our Product Family</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Nine products. One coherent product story.</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BUILD_CARDS.map((card) => (
              <BuildCardItem key={card.name} card={card} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Why We Build</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Practical systems for teams doing real work.</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Adoption first</p>
              <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">Built to actually be used.</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Fancy software that nobody uses solves nothing. We design for fast adoption, low training requirements, and confidence from the first session.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Access-aware</p>
              <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">Public data stays public. Private stays private.</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">We use role-aware access so schools can share what they intend to share, and legal teams can collaborate without exposing client data.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Growing together</p>
              <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">Start with one product. Grow into the suite.</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Every product in the SSAMENJ suite points toward one coherent product story. Start with Report Lab, add Smart Pages, grow into the full School Connect platform.</p>
            </div>
          </div>
        </div>
      </section>

      <TestimonialsSection className="bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-7" compact />

      <section className="border-t border-slate-200 bg-blue-50/40 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-blue-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Start exploring</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                See the full product family in action.
              </h2>
            </div>
            <div className="grid gap-3 lg:col-span-4">
              <Link
                to="/products"
                className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-center text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25"
              >
                Browse Products
              </Link>
              <Link
                to="/demos"
                className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
              >
                Watch Demos
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
