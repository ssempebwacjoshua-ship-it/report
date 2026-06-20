import { type ReactNode, type SVGProps, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FloatingWhatsAppButton } from "../components/marketing/FloatingWhatsAppButton";
import { MarketingFeatureCard } from "../components/marketing/MarketingFeatureCard";
import { TestimonialsSection } from "../components/marketing/TestimonialsSection";

function Icon({ children, className, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {children}
    </svg>
  );
}

function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </Icon>
  );
}

function PlayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m9 7 8 5-8 5V7Z" />
    </Icon>
  );
}

function SchoolIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 10 12 4l9 6-9 6-9-6Z" />
      <path d="M6 11v6c0 1.1 2.7 2 6 2s6-.9 6-2v-6" />
      <path d="M12 10v9" />
    </Icon>
  );
}

function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </Icon>
  );
}

function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m5 5 14 14" />
      <path d="m19 5-14 14" />
    </Icon>
  );
}

function SparklesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z" />
      <path d="M19 12l.8 2.2L22 15l-2.2.8L19 18l-.8-2.2L16 15l2.2-.8L19 12Z" />
    </Icon>
  );
}

function CheckCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5L15.5 10" />
    </Icon>
  );
}

function FileTextIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </Icon>
  );
}

function GridIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </Icon>
  );
}

function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </Icon>
  );
}

function PrinterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M7 9V4h10v5" />
      <rect x="6" y="9" width="12" height="8" rx="2" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
    </Icon>
  );
}

function ShieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3 5 6v5c0 4.9 3.4 8.8 7 10 3.6-1.2 7-5.1 7-10V6l-7-3Z" />
    </Icon>
  );
}

function SmartphoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M10 6h4" />
      <path d="M12 18h.01" />
    </Icon>
  );
}

function BookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H6z" />
      <path d="M18 4h-7a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h7z" />
    </Icon>
  );
}

function Metric({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
      <p className="text-lg font-black text-white">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-blue-100">{label}</p>
    </div>
  );
}

const walkthroughCover = "https://img.youtube.com/vi/jZrp-jOhjwo/maxresdefault.jpg";

const smartPagesDocTypes = [
  "Circulars",
  "Timetables",
  "Meeting minutes",
  "Letters",
  "Forms",
  "Tables",
  "Action plans",
];

export function DemoPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  useEffect(() => {
    if (!videoOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setVideoOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [videoOpen]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => void navigate("/demo")}
            className="flex items-center gap-3 text-left"
          >
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/10">
              <SchoolIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black tracking-tight text-slate-950">School Connect</p>
              <p className="text-[11px] uppercase tracking-[0.22em] text-blue-700">Powering Smart Schools</p>
            </div>
          </button>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex">
            <a href="#report-lab" className="transition hover:text-blue-700">Report Lab</a>
            <a href="#smart-pages" className="transition hover:text-blue-700">Smart Pages</a>
            <button type="button" onClick={() => void navigate("/features-demo")} className="transition hover:text-blue-700">
              Features Demo
            </button>
            <button type="button" onClick={() => void navigate("/pricing")} className="transition hover:text-blue-700">
              Pricing
            </button>
            <button type="button" onClick={() => void navigate("/contact")} className="transition hover:text-blue-700">
              Contact
            </button>
            <a href="#why-school-connect" className="transition hover:text-blue-700">Why School Connect</a>
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={() => void navigate("/login")}
              className="btn marketing-button-motion rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setVideoOpen(true)}
              className="btn marketing-button-motion rounded-full bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25"
            >
              Watch Demo
              <PlayIcon className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((current) => !current)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 md:hidden"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
            <div className="grid gap-2">
              <a
                href="#report-lab"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                Report Lab
              </a>
              <a
                href="#smart-pages"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                Smart Pages
              </a>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void navigate("/features-demo");
                }}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700"
              >
                Features Demo
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void navigate("/pricing");
                }}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700"
              >
                Pricing
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void navigate("/contact");
                }}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700"
              >
                Contact
              </button>
              <a
                href="#why-school-connect"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                Why School Connect
              </a>
              <button
                type="button"
                onClick={() => void navigate("/login")}
                className="btn marketing-button-motion rounded-2xl border border-blue-200 bg-white px-4 py-3 text-left text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setVideoOpen(true);
                }}
                className="btn marketing-button-motion rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25"
              >
                Watch Demo
                <PlayIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <main>
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden border-b border-blue-100 text-white"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(8, 18, 55, 0.92), rgba(10, 76, 160, 0.72))",
          }}
        >
          <div className="absolute inset-0 bg-dot-grid opacity-[0.18]" />
          <div className="relative mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-12">
            <div className="lg:col-span-6">
              <div className="marketing-fade-up inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-50">
                <SparklesIcon className="h-3.5 w-3.5" />
                School Connect for smart schools
              </div>
              <h1 className="marketing-fade-up-delay-1 mt-2 max-w-xl text-3xl font-black leading-tight tracking-tight text-white lg:text-4xl">
                Stop retyping school work. Generate reports and clean documents faster.
              </h1>
              <p className="marketing-fade-up-delay-2 mt-2.5 max-w-xl text-sm leading-6 text-blue-50 sm:text-base">
                Report Lab helps schools generate professional student reports from marks. Smart Pages
                turns scanned, handwritten, or messy school documents into clean, ready-to-print PDFs.
              </p>

              <div className="marketing-fade-up-delay-3 mt-3.5 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setVideoOpen(true)}
                  className="btn marketing-button-motion rounded-xl bg-white px-4 py-2.5 text-sm font-black text-blue-700 hover:bg-blue-50"
                >
                  Watch Demo
                  <PlayIcon className="h-4 w-4" />
                </button>
                <a
                  href="#report-lab"
                  className="btn marketing-button-motion rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15"
                >
                  Explore Report Lab
                </a>
                <a
                  href="#smart-pages"
                  className="btn marketing-button-motion rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15"
                >
                  Explore Smart Pages
                </a>
              </div>

              <div className="mt-4 hidden grid-cols-1 gap-3 sm:grid-cols-3 lg:grid">
                <div className="marketing-fade-up-delay-1"><Metric value="Less manual typing" label="UPLOAD, REVIEW, GENERATE" /></div>
                <div className="marketing-fade-up-delay-2"><Metric value="Parent-ready reports" label="PRINT, DOWNLOAD, OR SHARE" /></div>
                <div className="marketing-fade-up-delay-3"><Metric value="Clean school documents" label="FROM SCAN TO POLISHED PDF" /></div>
              </div>
            </div>

            {/* ── Hero video card ─────────────────────────────────────────── */}
            <div className="lg:col-span-6">
              <div className="marketing-card-motion marketing-fade-up-delay-2 overflow-hidden rounded-[1.5rem] border border-white/30 bg-white/95 p-2 shadow-xl backdrop-blur">
                <div className="mb-2 px-2 pt-1.5">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                    FULL SYSTEM WALKTHROUGH
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Click to watch the full system walkthrough.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setVideoOpen(true)}
                  className="group relative block w-full overflow-hidden rounded-[1rem] border border-slate-200 bg-slate-100 text-left"
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded-[1rem]">
                    <img
                      src={walkthroughCover}
                      alt="School Connect full system walkthrough"
                      className="absolute inset-0 h-full w-full scale-[1.14] object-cover object-center transition duration-300 group-hover:scale-[1.18]"
                      loading="eager"
                    />

                    <div className="absolute inset-0 bg-slate-950/10 transition group-hover:bg-slate-950/20" />

                    <div className="absolute inset-0 grid place-items-center">
                      <div className="marketing-play-pulse flex h-16 w-16 items-center justify-center rounded-full bg-white/85 text-blue-700 shadow-2xl shadow-blue-600/25 backdrop-blur transition group-hover:scale-105">
                        <PlayIcon className="h-8 w-8 translate-x-0.5" />
                      </div>
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 rounded-2xl bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
                      <p className="text-sm font-black text-slate-950">Click to watch full system walkthrough</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">Report Lab + Smart Pages</p>
                    </div>
                  </div>
                </button>

                {/* Product labels under video */}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 px-2 pb-1">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black text-blue-700">Report Lab</span>
                  <span className="text-slate-300">·</span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black text-blue-700">Smart Pages</span>
                  <span className="text-slate-300">·</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">School demo walkthrough</span>
                </div>
              </div>

              {/* ── Mini product previews (Report Lab + Smart Pages) ─────── */}
              <div className="mt-3 grid grid-cols-2 gap-3">
                {/* Mini Report Lab: marks table */}
                <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/95 shadow-lg backdrop-blur">
                  <div className="bg-blue-600 px-3 py-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-blue-100">Report Lab</p>
                  </div>
                  <div className="p-2">
                    <div className="overflow-hidden rounded-lg border border-slate-100 text-[10px]">
                      <div className="grid grid-cols-3 bg-slate-50 px-2 py-1 font-black text-slate-500">
                        <span>Student</span>
                        <span className="text-center">Score</span>
                        <span className="text-center">Grade</span>
                      </div>
                      {[
                        ["Aisha K.", "87%", "A"],
                        ["Brian M.", "74%", "B+"],
                        ["Carol T.", "91%", "A+"],
                      ].map(([name, score, grade]) => (
                        <div key={name} className="grid grid-cols-3 border-t border-slate-50 px-2 py-1 text-slate-700">
                          <span className="truncate font-semibold">{name}</span>
                          <span className="text-center font-black text-slate-900">{score}</span>
                          <span className="text-center font-semibold text-blue-600">{grade}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1">
                      <CheckCircleIcon className="h-3 w-3 text-emerald-500" />
                      <p className="text-[10px] text-slate-500">3 students · Term 2</p>
                    </div>
                  </div>
                </div>

                {/* Mini Smart Pages: scan → PDF */}
                <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/95 shadow-lg backdrop-blur">
                  <div className="bg-blue-600 px-3 py-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-blue-100">Smart Pages</p>
                  </div>
                  <div className="p-2">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                      <div className="rounded-lg border border-orange-100 bg-orange-50 p-1.5">
                        <p className="mb-1 text-[9px] font-black text-orange-600">Scan</p>
                        <div className="space-y-1">
                          <div className="h-1.5 w-3/4 rounded bg-orange-300 opacity-60" style={{ transform: "rotate(-0.8deg)" }} />
                          <div className="h-1.5 w-full rounded bg-orange-300 opacity-40" />
                          <div className="h-1.5 w-2/3 rounded bg-orange-300 opacity-50" style={{ transform: "rotate(0.5deg)" }} />
                        </div>
                      </div>
                      <ArrowRightIcon className="h-3 w-3 shrink-0 text-slate-300" />
                      <div className="rounded-lg border border-blue-100 bg-blue-50 p-1.5">
                        <p className="mb-1 text-[9px] font-black text-blue-600">PDF</p>
                        <div className="space-y-1">
                          <div className="h-1.5 w-3/4 rounded bg-blue-400 opacity-80" />
                          <div className="h-1.5 w-full rounded bg-slate-200" />
                          <div className="h-1.5 w-5/6 rounded bg-slate-200" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1">
                      <CheckCircleIcon className="h-3 w-3 text-emerald-500" />
                      <p className="text-[10px] text-slate-500">Ready to print or share</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile metrics */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:hidden">
              <div className="marketing-fade-up-delay-1"><Metric value="Less manual typing" label="UPLOAD, REVIEW, GENERATE" /></div>
              <div className="marketing-fade-up-delay-2"><Metric value="Parent-ready reports" label="PRINT, DOWNLOAD, OR SHARE" /></div>
              <div className="marketing-fade-up-delay-3"><Metric value="Clean school documents" label="FROM SCAN TO POLISHED PDF" /></div>
            </div>
          </div>
        </section>

        {/* ── Product gallery strip ──────────────────────────────────────── */}
        <section className="border-b border-slate-100 bg-white px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

              {/* Card 1: Upload marks — mini spreadsheet mockup */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <div className="border-b border-slate-100 bg-white p-3">
                  <div className="overflow-hidden rounded-xl border border-slate-100 text-[10px]">
                    <div className="grid grid-cols-4 bg-blue-50 px-2 py-1.5 font-black text-blue-700">
                      <span className="col-span-2">Student</span>
                      <span className="text-center">Math</span>
                      <span className="text-center">Avg</span>
                    </div>
                    {[
                      ["A. Kato", "87", "89"],
                      ["B. Male", "74", "71"],
                      ["C. Tendo", "91", "88"],
                    ].map(([name, math, avg]) => (
                      <div key={name} className="grid grid-cols-4 border-t border-slate-50 px-2 py-1.5 text-slate-700">
                        <span className="col-span-2 truncate font-semibold">{name}</span>
                        <span className="text-center">{math}</span>
                        <span className="text-center font-black text-slate-900">{avg}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-600 text-white">
                    <FileTextIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-950">Upload marks</p>
                    <p className="text-[11px] text-slate-500">Class, subject, term</p>
                  </div>
                </div>
              </div>

              {/* Card 2: Generate reports — mini report card mockup */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <div className="border-b border-slate-100 bg-white p-3">
                  <div className="overflow-hidden rounded-xl border border-slate-100 text-[10px]">
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-1.5">
                      <p className="font-black text-white">Student Report</p>
                      <p className="text-blue-200">B. Male · S3 Blue · Term 2</p>
                    </div>
                    <div className="space-y-1 p-2">
                      {[
                        ["Mathematics", "74%", "Pass"],
                        ["English", "68%", "Pass"],
                        ["Sciences", "82%", "Credit"],
                      ].map(([sub, score, grade]) => (
                        <div key={sub} className="flex items-center justify-between">
                          <span className="text-slate-600">{sub}</span>
                          <span className="font-black text-slate-900">
                            {score} <span className="font-semibold text-blue-600">{grade}</span>
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center gap-1 border-t border-slate-100 pt-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <p className="text-slate-500">Parent link ready</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500 text-white">
                    <PrinterIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-950">Generate reports</p>
                    <p className="text-[11px] text-slate-500">Print, download, or share</p>
                  </div>
                </div>
              </div>

              {/* Card 3: Clean school documents — mini before/after mockup */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <div className="border-b border-slate-100 bg-white p-3">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <div className="overflow-hidden rounded-lg border border-orange-100 bg-orange-50 p-2 text-[10px]">
                      <p className="mb-1.5 font-black text-orange-600">Handwritten</p>
                      <div className="space-y-1">
                        <div className="h-1.5 w-3/4 rounded bg-orange-300 opacity-60" style={{ transform: "rotate(-0.8deg)" }} />
                        <div className="h-1.5 w-full rounded bg-orange-300 opacity-40" style={{ transform: "rotate(0.4deg)" }} />
                        <div className="h-1.5 w-2/3 rounded bg-orange-300 opacity-55" style={{ transform: "rotate(-0.3deg)" }} />
                        <div className="h-1.5 w-5/6 rounded bg-orange-300 opacity-45" />
                      </div>
                    </div>
                    <ArrowRightIcon className="h-3 w-3 shrink-0 text-slate-300" />
                    <div className="overflow-hidden rounded-lg border border-blue-100 bg-blue-50 p-2 text-[10px]">
                      <p className="mb-1.5 font-black text-blue-600">Clean PDF</p>
                      <div className="space-y-1">
                        <div className="h-1.5 w-3/4 rounded bg-blue-400 opacity-80" />
                        <div className="h-1.5 w-full rounded bg-slate-200" />
                        <div className="h-1.5 w-5/6 rounded bg-slate-200" />
                        <div className="h-1.5 w-full rounded bg-slate-200" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-700 text-white">
                    <SparklesIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-950">Clean school documents</p>
                    <p className="text-[11px] text-slate-500">From scan to polished PDF</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Report Lab ────────────────────────────────────────────────── */}
        <section id="report-lab" className="border-b border-slate-200 bg-white px-4 py-6 lg:py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">REPORT LAB</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                A smarter way to prepare school reports.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Report Lab is a School Connect product built to help schools move from manual
                marksheets and formatting delays to clean, professional student reports. Upload
                marks, review results, generate reports, print them, and share parent-ready links
                from one guided workflow.
              </p>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <MarketingFeatureCard
                step={1}
                title="Upload marks"
                body="Bring marks into the system by class, stream, subject, and term."
                icon={<FileTextIcon className="h-5 w-5" />}
                tone="blue"
              />
              <MarketingFeatureCard
                step={2}
                title="Generate reports"
                body="Create professional student reports with grades, remarks, summaries, and school-ready presentation."
                icon={<PrinterIcon className="h-5 w-5" />}
                tone="slate"
              />
              <MarketingFeatureCard
                step={3}
                title="Print and share"
                body="Print, download, or share secure parent links when the school is ready."
                icon={<LockIcon className="h-5 w-5" />}
                tone="emerald"
              />
            </div>

            {/* Report Lab visual proof: marksheet → generated report */}
            <div className="mt-6 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
              <div className="border-b border-blue-50 bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">REPORT LAB</p>
                <p className="text-base font-black text-white">From marksheet to parent-ready report</p>
              </div>
              <div className="grid gap-px bg-slate-100 lg:grid-cols-2">

                {/* Left: marks upload mockup */}
                <div className="bg-white p-4">
                  <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    Step 1 — Upload marks
                  </p>
                  <div className="overflow-hidden rounded-xl border border-slate-200 text-xs">
                    <div className="grid grid-cols-5 border-b border-slate-200 bg-slate-50 px-3 py-2 font-black text-slate-600">
                      <span className="col-span-2">Student</span>
                      <span className="text-center">Math</span>
                      <span className="text-center">Eng</span>
                      <span className="text-center">Sci</span>
                    </div>
                    {[
                      ["Aisha K.", "87", "92", "78"],
                      ["Brian M.", "74", "68", "82"],
                      ["Carol T.", "91", "85", "88"],
                    ].map(([name, m, e, s]) => (
                      <div key={name} className="grid grid-cols-5 border-b border-slate-100 px-3 py-2 last:border-0">
                        <span className="col-span-2 font-semibold text-slate-800">{name}</span>
                        <span className="text-center text-slate-700">{m}</span>
                        <span className="text-center text-slate-700">{e}</span>
                        <span className="text-center text-slate-700">{s}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" />
                    <p className="text-[11px] text-slate-500">3 students · 3 subjects · Term 2 · S3 Blue</p>
                  </div>
                </div>

                {/* Right: generated student report mockup */}
                <div className="bg-white p-4">
                  <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    Step 4 — Generated report
                  </p>
                  <div className="overflow-hidden rounded-xl border border-slate-200 text-xs">
                    <div className="border-b border-blue-100 bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-blue-200">School Connect · Report Lab</p>
                      <p className="text-sm font-black text-white">Student Academic Report</p>
                    </div>
                    <div className="p-3">
                      <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                        <div><span className="text-slate-500">Name: </span><span className="font-semibold text-slate-800">Aisha K.</span></div>
                        <div><span className="text-slate-500">Class: </span><span className="font-semibold text-slate-800">S3 Blue</span></div>
                        <div><span className="text-slate-500">Term: </span><span className="font-semibold text-slate-800">Term 2</span></div>
                        <div><span className="text-slate-500">Stream: </span><span className="font-semibold text-slate-800">Sciences</span></div>
                      </div>
                      <div className="space-y-1.5">
                        {[
                          { sub: "Mathematics", score: "87%", grade: "Distinction" },
                          { sub: "English", score: "92%", grade: "Distinction" },
                          { sub: "Sciences", score: "78%", grade: "Credit" },
                        ].map(({ sub, score, grade }) => (
                          <div key={sub} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                            <span className="text-slate-600">{sub}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900">{score}</span>
                              <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{grade}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2.5 flex items-center gap-1.5 border-t border-slate-100 pt-2">
                        <LockIcon className="h-3 w-3 text-emerald-500" />
                        <p className="text-[11px] text-slate-500">Secure parent link generated · Ready to share</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* ── Smart Pages ───────────────────────────────────────────────── */}
        <section id="smart-pages" className="border-b border-slate-200 bg-slate-50 px-4 py-6 lg:py-8 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">SMART PAGES</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                From handwritten school documents to ready-to-print PDFs.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Upload a handwritten note, scanned letter, form, table, or school document. Smart
                Pages reads it, cleans it, formats it, and helps you produce a polished PDF you can
                print or share without typing it all again.
              </p>

              {/* Document types */}
              <div className="mt-3 flex flex-wrap gap-2">
                {smartPagesDocTypes.map((docType) => (
                  <span key={docType} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">
                    {docType}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setVideoOpen(true)}
                  className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25"
                >
                  Explore Smart Pages
                  <PlayIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void navigate("/login")}
                  className="marketing-button-motion inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-50"
                >
                  Sign in
                </button>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="marketing-card-motion rounded-[1.75rem] border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="grid gap-3 md:grid-cols-2">
                  <MarketingFeatureCard
                    step={1}
                    title="Upload scan or handwriting"
                    body="Upload handwritten or scanned school documents."
                    icon={<GridIcon className="h-5 w-5" />}
                    tone="blue"
                  />
                  <MarketingFeatureCard
                    step={2}
                    title="Extract and clean content"
                    body="Let Smart Pages extract the important content and organize it clearly."
                    icon={<BookIcon className="h-5 w-5" />}
                    tone="emerald"
                  />
                  <MarketingFeatureCard
                    step={3}
                    title="Format professionally"
                    body="Turn rough school notes into clean, structured pages."
                    icon={<SmartphoneIcon className="h-5 w-5" />}
                    tone="slate"
                  />
                  <MarketingFeatureCard
                    step={4}
                    title="Print, download, or share"
                    body="Generate a ready PDF for printing, downloading, or sharing."
                    icon={<ShieldIcon className="h-5 w-5" />}
                    tone="emerald"
                  />
                </div>

                {/* Smart Pages before/after: structured document mockup */}
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-4 py-2.5">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-700">FROM MESSY SCHOOL PAPER TO CLEAN DIGITAL PAGE</p>
                  </div>
                  <div className="grid gap-px bg-slate-100 sm:grid-cols-3">

                    {/* Before: handwritten circular */}
                    <div className="bg-orange-50 p-3">
                      <div className="mb-2 flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-orange-400" />
                        <p className="text-[10px] font-black uppercase tracking-wider text-orange-700">Before</p>
                      </div>
                      <div className="space-y-1.5 text-[11px]">
                        <p className="inline-block font-semibold text-orange-900" style={{ fontFamily: "Georgia, serif", transform: "rotate(-0.8deg)" }}>
                          Date: 15/03/2025
                        </p>
                        <div className="h-px bg-orange-200" />
                        <p className="inline-block text-orange-800" style={{ fontFamily: "Georgia, serif", transform: "rotate(0.4deg)" }}>
                          Circular No.12
                        </p>
                        <p className="inline-block text-orange-700 opacity-80" style={{ fontFamily: "Georgia, serif", transform: "rotate(-0.5deg)" }}>
                          Dear parent/guardian,
                        </p>
                        <p className="inline-block text-orange-600 opacity-70" style={{ fontFamily: "Georgia, serif", transform: "rotate(0.3deg)" }}>
                          You are invited...
                        </p>
                        <p className="inline-block text-orange-600 opacity-60" style={{ fontFamily: "Georgia, serif", transform: "rotate(-0.4deg)" }}>
                          monday 17th march
                        </p>
                      </div>
                      <p className="mt-2.5 text-[10px] font-semibold text-orange-600">Handwritten circular</p>
                    </div>

                    {/* Middle: Smart Pages extraction */}
                    <div className="flex flex-col items-center justify-center gap-2 bg-white p-3">
                      <div className="rounded-2xl bg-blue-600 px-3 py-1.5 text-center shadow-md shadow-blue-600/20">
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-200">Smart Pages</p>
                        <p className="text-[11px] font-black text-white">Extract &amp; Clean</p>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-300" />
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-200" />
                      </div>
                      <p className="text-center text-[10px] leading-4 text-slate-500">Reads, organises, formats</p>
                    </div>

                    {/* After: clean formatted circular */}
                    <div className="bg-white p-3">
                      <div className="mb-2 flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">After</p>
                      </div>
                      <div className="overflow-hidden rounded-xl border border-slate-200 text-[10px]">
                        <div className="border-b border-blue-100 bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-1.5">
                          <p className="font-black uppercase tracking-wide text-white">SCHOOL CIRCULAR</p>
                          <p className="text-blue-200">No. 12 · March 2025</p>
                        </div>
                        <div className="space-y-1.5 p-2.5">
                          <p className="font-black text-slate-900">Parent Meeting Notice</p>
                          <div className="h-1.5 w-full rounded bg-slate-100" />
                          <div className="h-1.5 w-4/5 rounded bg-slate-100" />
                          <div className="h-1.5 w-full rounded bg-slate-100" />
                          <div className="h-1.5 w-3/4 rounded bg-slate-100" />
                          <div className="mt-2 flex items-center gap-1 border-t border-slate-100 pt-1.5">
                            <PrinterIcon className="h-3 w-3 text-blue-600" />
                            <p className="text-slate-500">Ready to print or share</p>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Use cases (was Testimonials) ──────────────────────────────── */}
        <TestimonialsSection className="bg-white px-4 py-6 lg:py-8 sm:px-6 lg:px-8" compact />

        {/* ── Why School Connect ────────────────────────────────────────── */}
        <section id="why-school-connect" className="bg-slate-50 px-4 py-6 lg:py-8 sm:px-6 lg:px-8">
          <div className="marketing-card-motion mx-auto max-w-7xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-8">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">WHY SCHOOL CONNECT</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                  One platform, growing with your school.
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  School Connect starts with practical tools schools need today — Report Lab for
                  academic reporting and Smart Pages for intelligent documents. More smart school
                  workflows can be added as the school grows.
                </p>
              </div>
              <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
                <button
                  type="button"
                  onClick={() => setVideoOpen(true)}
                  className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25"
                >
                  Watch Demo
                  <PlayIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void navigate("/login")}
                  className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
                >
                  Sign in
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Video modal ───────────────────────────────────────────────────── */}
      {videoOpen ? (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="School Connect full system walkthrough video"
          onClick={() => setVideoOpen(false)}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">FULL SYSTEM WALKTHROUGH</p>
                <p className="text-sm font-semibold text-slate-600">Report Lab + Smart Pages</p>
              </div>

              <button
                type="button"
                onClick={() => setVideoOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                aria-label="Close walkthrough video"
              >
                Close
              </button>
            </div>

            <div className="aspect-video w-full bg-slate-950">
              <iframe
                className="h-full w-full"
                src="https://www.youtube-nocookie.com/embed/jZrp-jOhjwo?autoplay=1&rel=0&modestbranding=1"
                title="School Connect full system walkthrough"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      ) : null}

      <FloatingWhatsAppButton />
    </div>
  );
}
