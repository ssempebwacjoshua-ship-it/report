import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaqSection } from "../components/marketing/FaqSection";
import { TestimonialsSection } from "../components/marketing/TestimonialsSection";
import {
  ArrowRightIcon,
  BookIcon,
  FileTextIcon,
  GridIcon,
  LockIcon,
  PlayIcon,
  PrinterIcon,
  ShieldIcon,
  SmartphoneIcon,
  SparklesIcon,
} from "../components/marketing/Icons";
import { MarketingFeatureCard } from "../components/marketing/MarketingFeatureCard";
import { buildWhatsAppUrl } from "../config/contact";
import { DEMOS_FAQS } from "../content/discoverability";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I'd like to book a product demo for my organisation.",
);

const REPORT_LAB_VIDEO_ID = "jZrp-jOhjwo";
const SMART_PAGES_VIDEO_ID = "F2kWYFQujK4";

type DemoItem = {
  id: string;
  name: string;
  description: string;
  videoId: string;
  caption: string;
  subtitle: string;
  thumbnailSrc?: string;
};

const FEATURE_ITEMS: DemoItem[] = [
  {
    id: "report-lab",
    name: "Report Lab Demo",
    description: "Generate student reports from marksheets and share secure parent links.",
    videoId: REPORT_LAB_VIDEO_ID,
    caption: "Click to watch full system walkthrough",
    subtitle: "Report Lab + Smart Pages walkthrough",
  },
  {
    id: "smart-pages",
    name: "Smart Pages Demo",
    description: "Turn school documents into clean, editable, printable pages.",
    videoId: SMART_PAGES_VIDEO_ID,
    caption: "Click to watch Smart Pages demo",
    subtitle: "Smart Pages document workflow walkthrough",
  },
  {
    id: "nfc",
    name: "School Connect NFC Demo",
    description: "See how NFC wristbands work for gate access, attendance, canteen payments, and offline-ready school operations.",
    videoId: "nU4EvHCn0U0",
    caption: "Click to watch NFC demo",
    subtitle: "Gate access, attendance, canteen, and offline scanning",
    thumbnailSrc: "/images/nfc-wristband-hero.png",
  },
];

// ── Shared helpers ─────────────────────────────────────────────────────────────

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
      <p className="text-lg font-black text-white">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-blue-100">{label}</p>
    </div>
  );
}

// ── Premium demo player — reused for hero and playlist ─────────────────────────

function DemoShowcasePlayer({
  item,
  onPlay,
  variant = "hero",
  className = "",
}: {
  item: DemoItem;
  onPlay: () => void;
  variant?: "hero" | "playlist";
  className?: string;
}) {
  const thumbnail = item.thumbnailSrc ?? `https://img.youtube.com/vi/${item.videoId}/maxresdefault.jpg`;
  const outerCard =
    variant === "hero"
      ? "motion-media floating-media soft-glow border border-white/30 bg-white/95 shadow-xl backdrop-blur"
      : "motion-card border border-slate-200 bg-white shadow-sm";

  return (
    <div className={`overflow-hidden rounded-[1.5rem] p-2 ${outerCard} ${className}`}>
      <div className="mb-2 px-2 pt-1.5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">{item.name}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{item.subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onPlay}
        className="group relative block w-full overflow-hidden rounded-[1rem] border border-slate-200 bg-slate-100 text-left"
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-[1rem]">
          <img
            src={thumbnail}
            alt={item.name}
            className="absolute inset-0 h-full w-full scale-[1.14] object-cover object-center transition duration-300 group-hover:scale-[1.18]"
            loading="eager"
          />
          {/* Top-right badge */}
          <div className="absolute right-3 top-3">
            <span className="inline-flex items-center rounded-full border border-blue-200/50 bg-white/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700 shadow-sm backdrop-blur-sm">
              VIDEO DEMO
            </span>
          </div>
          <div className="absolute inset-0 bg-slate-950/10 transition group-hover:bg-slate-950/20" />
          {/* Centered play button */}
          <div className="absolute inset-0 grid place-items-center">
            <div className="marketing-play-pulse flex h-16 w-16 items-center justify-center rounded-full bg-white/85 text-blue-700 shadow-2xl shadow-blue-600/25 backdrop-blur transition group-hover:scale-105">
              <PlayIcon className="h-8 w-8 translate-x-0.5" />
            </div>
          </div>
          {/* Bottom caption overlay */}
          <div className="absolute bottom-3 left-3 right-3 rounded-2xl bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
            <p className="text-sm font-black text-slate-950">{item.caption}</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-600">{item.subtitle}</p>
          </div>
        </div>
      </button>
    </div>
  );
}

// ── Demo selector card ─────────────────────────────────────────────────────────

function DemoCard({
  item,
  active,
  onSelect,
}: {
  item: DemoItem;
  active: boolean;
  onSelect: (item: DemoItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
    className={`motion-card motion-card-stagger w-full rounded-2xl border p-4 text-left transition ${
        active
          ? "border-blue-500 bg-blue-50 text-blue-800 shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black leading-snug text-slate-950">{item.name}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
        </div>
        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
          Video
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-blue-700">{active ? "Now playing" : "Play video"}</span>
        <ArrowRightIcon className="h-4 w-4 text-blue-700" />
      </div>
    </button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function DemosPage() {
  const [videoOpen, setVideoOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(FEATURE_ITEMS[0]?.id ?? "report-lab");

  const selectedItem = useMemo(
    () => FEATURE_ITEMS.find((item) => item.id === selectedId) ?? FEATURE_ITEMS[0]!,
    [selectedId],
  );

  useEffect(() => {
    if (!videoOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setVideoOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [videoOpen]);

  return (
    <div className="bg-slate-50 text-slate-950">
      {/* Blue gradient hero */}
      <section className="site-hero-blue site-hero-compact hero-rhythm border-b text-white" style={{ borderColor: "rgba(15,91,216,0.3)" }}>
        <div className="absolute inset-0 bg-dot-grid opacity-[0.15]" />
        <div className="relative mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-6">
            <div className="marketing-fade-up inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-50">
              <SparklesIcon className="h-3.5 w-3.5" />
              School Connect for smart schools
            </div>
            <h1 className="marketing-fade-up-delay-1 mt-2 hero-title font-black text-white">
              Powering smart schools with digital reports and intelligent documents.
            </h1>
            <p className="marketing-fade-up-delay-2 mt-2.5 max-w-xl text-sm leading-6 text-blue-50 sm:text-base">
              School Connect is a growing digital workspace for modern schools. Use Report Lab to
              generate student reports faster, and Smart Pages to turn handwritten school documents
              into ready-to-print PDFs without typing everything again.
            </p>

            <div className="marketing-fade-up-delay-3 mt-3.5 flex flex-col gap-2 sm:flex-row">
              <a
                href={BOOK_DEMO_URL}
                target="_blank"
                rel="noreferrer"
                className="btn marketing-button-motion motion-cta rounded-xl bg-white px-4 py-2.5 text-sm font-black text-blue-700 hover:bg-blue-50"
              >
                Request Demo
                <ArrowRightIcon className="link-arrow h-4 w-4" />
              </a>
              <a
                href="#report-lab"
                className="btn marketing-button-motion motion-cta rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15"
              >
                Explore Report Lab
              </a>
              <a
                href="#smart-pages"
                className="btn marketing-button-motion motion-cta rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15"
              >
                Explore Smart Pages
              </a>
            </div>

            <div className="mt-4 hidden grid-cols-1 gap-3 sm:grid-cols-3 lg:grid">
              <div className="marketing-fade-up-delay-1"><Metric value="School Connect" label="POWERING SMART SCHOOLS." /></div>
              <div className="marketing-fade-up-delay-2"><Metric value="Report Lab" label="STUDENT REPORTS FASTER." /></div>
              <div className="marketing-fade-up-delay-3"><Metric value="Smart Pages" label="HANDWRITTEN DOCS TO READY PDFS." /></div>
            </div>
          </div>

          {/* Hero video — always shows Report Lab walkthrough */}
          <div className="lg:col-span-6">
            <DemoShowcasePlayer
              item={FEATURE_ITEMS[0]!}
              variant="hero"
              onPlay={() => {
                setSelectedId("report-lab");
                setVideoOpen(true);
              }}
              className="marketing-card-motion marketing-fade-up-delay-2"
            />
          </div>

          {/* Mobile metrics */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:hidden">
            <div className="marketing-fade-up-delay-1"><Metric value="School Connect" label="POWERING SMART SCHOOLS." /></div>
            <div className="marketing-fade-up-delay-2"><Metric value="Report Lab" label="STUDENT REPORTS FASTER." /></div>
            <div className="marketing-fade-up-delay-3"><Metric value="Smart Pages" label="HANDWRITTEN DOCS TO READY PDFS." /></div>
          </div>
        </div>
      </section>

      {/* Interactive video playlist */}
      <section className="border-b border-slate-200 bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Demo playlist</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Select a demo to watch</h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
            {/* Main premium player — switches with selected demo */}
            <DemoShowcasePlayer
              item={selectedItem}
              variant="playlist"
              onPlay={() => setVideoOpen(true)}
            />

            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Choose a demo</p>
                <div className="mt-3 grid gap-3">
                  {FEATURE_ITEMS.map((item) => (
                    <DemoCard
                      key={item.id}
                      item={item}
                      active={selectedItem.id === item.id}
                      onSelect={(next) => setSelectedId(next.id)}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Quick links</p>
                <div className="mt-3 flex flex-col gap-2">
                  <a href="#report-lab" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Read about Report Lab ↓</a>
                  <a href="#smart-pages" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Read about Smart Pages ↓</a>
                  <Link to="/report-lab" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    Open the Report Lab page
                  </Link>
                  <Link to="/smart-pages" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    Open the Smart Pages page
                  </Link>
                  <a href={BOOK_DEMO_URL} target="_blank" rel="noreferrer" className="motion-cta rounded-xl border border-blue-200 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50">Request a walkthrough on WhatsApp</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Report Lab section */}
      <section id="report-lab" className="border-b border-slate-200 bg-white px-4 py-6 lg:py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Report Lab</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              A smarter way to prepare school reports.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Report Lab is a School Connect product built to help schools move from manual
              marksheets and formatting delays to clean, professional student reports. Upload marks,
              review results, generate reports, print them, and share parent-ready links from one
              guided workflow.
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
        </div>
      </section>

      {/* Smart Pages section */}
      <section id="smart-pages" className="border-b border-slate-200 bg-slate-50 px-4 py-6 lg:py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Smart Pages</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              From handwritten school documents to ready-to-print PDFs.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Upload a handwritten note, scanned letter, form, table, or school document. Smart Pages
              reads it, cleans it, formats it, and helps you produce a polished PDF you can print or
              share without typing it all again.
            </p>

            <div className="mt-3.5 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/pricing"
                className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25"
              >
                Explore Smart Pages
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link
                to="/contact"
                className="marketing-button-motion inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-50"
              >
                Contact
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="marketing-card-motion rounded-[1.75rem] border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <MarketingFeatureCard
                  step={1}
                  title="Upload handwriting"
                  body="Upload handwritten or scanned school documents."
                  icon={<GridIcon className="h-5 w-5" />}
                  tone="blue"
                />
                <MarketingFeatureCard
                  step={2}
                  title="Read and clean"
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
                  title="Print or share"
                  body="Generate a ready PDF for printing, downloading, or sharing."
                  icon={<ShieldIcon className="h-5 w-5" />}
                  tone="emerald"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <TestimonialsSection className="bg-white px-4 py-6 lg:py-8 sm:px-6 lg:px-8" compact />

      {/* Why School Connect */}
      <section id="why-school-connect" className="bg-slate-50 px-4 py-6 lg:py-8 sm:px-6 lg:px-8">
        <div className="marketing-card-motion mx-auto max-w-7xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Why School Connect</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                One platform, growing with your school.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                School Connect starts with practical tools schools need today — Report Lab for academic
                reporting and Smart Pages for intelligent documents. More smart school workflows can be
                added as the school grows.
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
              <a
                href={BOOK_DEMO_URL}
                target="_blank"
                rel="noreferrer"
                className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25"
              >
                Request Demo
                <ArrowRightIcon className="h-4 w-4" />
              </a>
              <Link
                to="/contact"
                className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
              >
                Contact
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Fullscreen modal — plays whichever demo is currently selected */}
      {videoOpen ? (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedItem.name} video`}
          onClick={() => setVideoOpen(false)}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">{selectedItem.name}</p>
                <p className="text-sm font-semibold text-slate-600">{selectedItem.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setVideoOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                aria-label="Close video"
              >
                Close
              </button>
            </div>
            <div className="aspect-video w-full bg-slate-950">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${selectedItem.videoId}?autoplay=1&rel=0&modestbranding=1`}
                title={selectedItem.name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      ) : null}

      <section className="border-t border-slate-200 bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <FaqSection
          title="Demo questions"
          description="These help schools decide what to ask when they book a walkthrough."
          items={DEMOS_FAQS}
        />
      </section>
    </div>
  );
}
