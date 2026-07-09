import { Link } from "react-router-dom";
import { FaqSection } from "../components/marketing/FaqSection";
import { TestimonialsSection } from "../components/marketing/TestimonialsSection";
import {
  ArrowRightIcon,
  CheckIcon,
  FileTextIcon,
  LockIcon,
  PrinterIcon,
  SparklesIcon,
} from "../components/marketing/Icons";
import { MarketingFeatureCard } from "../components/marketing/MarketingFeatureCard";
import { buildWhatsAppUrl } from "../config/contact";
import { HOME_FAQS } from "../content/discoverability";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I'd like to book a product demo for my organisation.",
);

const NFC_QUOTE_WA = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies, I would like a quotation for School Connect NFC for our school. Please share requirements and pricing.",
);


export function SSAMENJHomePage() {
  return (
    <div className="bg-slate-50 text-slate-950">
      {/* Slim launch offer strip */}
      <div
        className="border-b px-4 py-2 text-center text-[11px] leading-5 text-white"
        style={{ background: "#0B2F6B", borderColor: "rgba(255,255,255,0.1)" }}
      >
        <span className="font-black text-amber-300">Launch Offer:</span>{" "}
        <span className="font-medium text-white/90">First Term Free for pioneer schools — setup fee applies. Smart Pages trial includes 10 pages.</span>
      </div>

      <section className="home-hero-image-bg site-hero-compact hero-rhythm border-b text-white" style={{ borderColor: "rgba(15,91,216,0.3)" }}>
        <div className="absolute inset-0 bg-dot-grid opacity-[0.12]" />
        <div className="home-hero-content mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <div className="marketing-fade-up inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-50">
              <SparklesIcon className="h-3.5 w-3.5" />
              SSAMENJ Technologies
            </div>
            <h1 className="marketing-fade-up-delay-1 mt-2 hero-title font-black text-white">
              School management software for Uganda schools.
            </h1>
            <p className="marketing-fade-up-delay-2 mt-2.5 text-sm leading-6 text-blue-50 sm:text-base">
              SSAMENJ Technologies builds practical school management software for Uganda schools, plus digital products for legal teams and growing organizations. Start with Report Lab, Smart Pages, School Connect NFC, and Kids Wallet, then add more tools as the workflow grows.
            </p>

            <div className="marketing-fade-up-delay-3 mt-3.5 flex flex-col gap-2 sm:flex-row">
              <Link to="/demos" className="btn marketing-button-motion motion-cta rounded-xl bg-white px-4 py-2.5 text-sm font-black text-blue-700 hover:bg-blue-50">
                View Demos
                <ArrowRightIcon className="link-arrow h-4 w-4" />
              </Link>
              <Link to="/products" className="btn marketing-button-motion motion-cta rounded-xl border border-white bg-white/15 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/25">
                Explore Products
              </Link>
              <a href={BOOK_DEMO_URL} target="_blank" rel="noreferrer" className="btn marketing-button-motion motion-cta rounded-xl border border-white bg-white/15 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/25">
                Book Demo
              </a>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <Link
                to="/contact"
                className="motion-card motion-card-stagger marketing-fade-up-delay-1 min-w-0 cursor-pointer rounded-2xl border border-white/25 bg-white/[0.12] px-4 py-3 transition-all duration-200 hover:border-white/40 hover:bg-white/[0.18]"
                style={{ backdropFilter: "blur(6px)" }}
              >
                <p className="truncate text-sm font-black text-white">School Connect</p>
                <p className="mt-0.5 break-words text-[11px] uppercase tracking-[0.16em] text-blue-100">
                  School Management Software
                </p>
              </Link>
              <Link
                to="/report-lab"
                className="motion-card motion-card-stagger marketing-fade-up-delay-2 min-w-0 cursor-pointer rounded-2xl border border-white/25 bg-white/[0.12] px-4 py-3 transition-all duration-200 hover:border-white/40 hover:bg-white/[0.18]"
                style={{ backdropFilter: "blur(6px)" }}
              >
                <p className="truncate text-sm font-black text-white">Report Lab</p>
                <p className="mt-0.5 break-words text-[11px] uppercase tracking-[0.16em] text-blue-100">
                  Report Card System
                </p>
              </Link>
              <Link
                to="/smart-pages"
                className="motion-card motion-card-stagger marketing-fade-up-delay-3 min-w-0 cursor-pointer rounded-2xl border border-white/25 bg-white/[0.12] px-4 py-3 transition-all duration-200 hover:border-white/40 hover:bg-white/[0.18]"
                style={{ backdropFilter: "blur(6px)" }}
              >
                <p className="truncate text-sm font-black text-white">Smart Pages</p>
                <p className="mt-0.5 break-words text-[11px] uppercase tracking-[0.16em] text-blue-100">
                  Digital School Documents
                </p>
              </Link>
              <Link
                to="/nfc"
                className="motion-card motion-card-stagger marketing-fade-up-delay-3 min-w-0 cursor-pointer rounded-2xl border border-white/25 bg-white/[0.12] px-4 py-3 transition-all duration-200 hover:border-white/40 hover:bg-white/[0.18]"
                style={{ backdropFilter: "blur(6px)" }}
              >
                <p className="truncate text-sm font-black text-white">NFC Wristbands</p>
                <p className="mt-0.5 break-words text-[11px] uppercase tracking-[0.16em] text-blue-100">
                  Attendance and Gate Control
                </p>
              </Link>
              <Link
                to="/rentflow"
                className="motion-card motion-card-stagger marketing-fade-up-delay-3 min-w-0 cursor-pointer rounded-2xl border border-white/25 bg-white/[0.12] px-4 py-3 transition-all duration-200 hover:border-white/40 hover:bg-white/[0.18]"
                style={{ backdropFilter: "blur(6px)" }}
              >
                <p className="truncate text-sm font-black text-white">RentFlow</p>
                <p className="mt-0.5 break-words text-[11px] uppercase tracking-[0.16em] text-blue-100">
                  Property Management Software
                </p>
              </Link>
              <Link
                to="/cashless-canteen"
                className="motion-card motion-card-stagger marketing-fade-up-delay-3 min-w-0 cursor-pointer rounded-2xl border border-white/25 bg-white/[0.12] px-4 py-3 transition-all duration-200 hover:border-white/40 hover:bg-white/[0.18]"
                style={{ backdropFilter: "blur(6px)" }}
              >
                <p className="truncate text-sm font-black text-white">Cashless Canteen</p>
                <p className="mt-0.5 break-words text-[11px] uppercase tracking-[0.16em] text-blue-100">
                  Cashless School Canteen
                </p>
              </Link>
              <Link
                to="/stayos"
                className="motion-card motion-card-stagger marketing-fade-up-delay-3 min-w-0 cursor-pointer rounded-2xl border border-white/25 bg-white/[0.12] px-4 py-3 transition-all duration-200 hover:border-white/40 hover:bg-white/[0.18]"
                style={{ backdropFilter: "blur(6px)" }}
              >
                <p className="truncate text-sm font-black text-white">StayOS</p>
                <p className="mt-0.5 break-words text-[11px] uppercase tracking-[0.16em] text-blue-100">
                  Property Operations Software
                </p>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Report Lab</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">A school report card system built for Uganda schools.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Report Lab is built to help Uganda schools move from manual marksheets and formatting delays to clean, professional student reports. Upload marks, review results, generate reports, print them, and share parent-ready links from one guided workflow.
            </p>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <MarketingFeatureCard step={1} title="Upload marks" body="Bring marks into the system by class, stream, subject, and term." icon={<FileTextIcon className="h-5 w-5" />} tone="blue" />
            <MarketingFeatureCard step={2} title="Generate reports" body="Create professional student reports with grades, remarks, summaries, and school-ready presentation." icon={<PrinterIcon className="h-5 w-5" />} tone="slate" />
            <MarketingFeatureCard step={3} title="Print and share" body="Print, download, or share secure parent links when the school is ready." icon={<LockIcon className="h-5 w-5" />} tone="emerald" />
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Smart Pages</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Digital school documents from handwritten notes to ready-to-print PDFs.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Upload a handwritten note, scanned letter, form, table, or school document. Smart Pages reads it, cleans it, formats it, and helps you produce a polished PDF you can print or share without typing it all again.
            </p>

            <div className="mt-3.5 flex flex-col gap-3 sm:flex-row">
              <Link to="/demos" className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25">
                Watch Demo
              </Link>
              <Link to="/pricing" className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
                See Pricing
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="marketing-card-motion rounded-[1.5rem] border border-blue-200 bg-white p-3.5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">School Connect</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">One brand, two core products, and room to grow.</p>
              </div>
              <div className="marketing-card-motion rounded-[1.5rem] border border-slate-200 bg-white p-3.5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Report Lab</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">Academic reporting for schools that want faster, cleaner reports.</p>
              </div>
              <div className="marketing-card-motion marketing-soft-float rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-3.5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Smart Pages</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">Handwritten documents turned into polished PDFs and shareable pages.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── NFC section ── */}
      <section className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
            {/* Image */}
            <div className="order-2 lg:order-1 lg:col-span-5">
              <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg">
                <img
                  src="/images/nfc-wristband-hero.png"
                  alt="Student NFC wristband — tap to identify at gate, canteen, and attendance"
                  className="w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Copy */}
            <div className="order-1 lg:order-2 lg:col-span-7">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">School Connect NFC</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                NFC wristbands for attendance, gate access, and canteen wallets.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Tap-to-identify students for gate access, attendance, canteen wallets, and offline-ready school operations. Every student gets an NFC wristband, card, or tag linked to their school profile.
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {[
                  "Gate Security & Access Control",
                  "Attendance Tap-In / Tap-Out",
                  "Cashless Canteen via Kids Wallet",
                  "Offline-Ready Scanning",
                  "Role-Based Staff Access",
                  "Full Audit Trail",
                ].map((feat) => (
                  <div key={feat} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckIcon className="h-4 w-4 shrink-0 text-blue-600" />
                    {feat}
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/nfc"
                  className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl"
                >
                  Learn About NFC
                </Link>
                <a
                  href={NFC_QUOTE_WA}
                  target="_blank"
                  rel="noreferrer"
                  className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
                >
                  Request Quotation
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Built for schools</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">School Connect grows with your workflow.</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Report Lab, Smart Pages, and future school tools are designed to work together without creating unnecessary complexity.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Security</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Public data stays public, private data stays protected.</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                We use role-aware access and neutral public pages so schools can share only what they intend to share.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Custom work</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Tailored systems when the workflow is specific.</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                If a school or institution needs something custom, we build around the problem instead of forcing a generic setup.
              </p>
            </div>
          </div>
        </div>
      </section>

      <TestimonialsSection className="bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-7" compact />

      <section className="border-t border-slate-200 bg-blue-50/40 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-blue-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Ready to see SSAMENJ in action?</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Start with a walkthrough, then request the right package for your school.
              </h2>
            </div>
            <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
              <Link to="/demos" className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25">
                Watch Demo
              </Link>
              <Link to="/report-lab" className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
                See Report Lab
              </Link>
              <Link to="/smart-pages" className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
                See Smart Pages
              </Link>
              <a href="/pricing" className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
                View Pricing
              </a>
              <a href={BOOK_DEMO_URL} target="_blank" rel="noreferrer" className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        <FaqSection
          title="Home page questions"
          description="These are the quick questions schools usually ask before they move to a demo."
          items={HOME_FAQS}
        />
      </section>
    </div>
  );
}
