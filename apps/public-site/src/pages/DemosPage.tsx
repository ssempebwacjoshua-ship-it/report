import { Link } from "react-router-dom";
import { TestimonialsSection } from "../components/marketing/TestimonialsSection";
import { FileTextIcon, PlayIcon, ShieldIcon, SparklesIcon } from "../components/marketing/Icons";
import { MarketingFeatureCard } from "../components/marketing/MarketingFeatureCard";
import { buildWhatsAppUrl } from "../config/contact";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I'd like to book a product demo for my organisation.",
);

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
      <p className="text-lg font-black text-white">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-blue-100">{label}</p>
    </div>
  );
}

const walkthroughCover = "https://img.youtube.com/vi/jZrp-jOhjwo/maxresdefault.jpg";

export function DemosPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <section className="border-b border-blue-100 bg-gradient-to-br from-white via-blue-50 to-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Demos</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              See the product family in motion.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              School Connect, Report Lab, Smart Pages, and the surrounding product family are shaped around practical school and institutional workflows.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <a href={BOOK_DEMO_URL} target="_blank" rel="noreferrer" className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25">
                Request demo on WhatsApp
              </a>
              <Link to="/pricing" className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
                View pricing
              </Link>
            </div>

            <div className="mt-4 hidden grid-cols-1 gap-3 sm:grid-cols-3 lg:grid">
              <Metric value="School Connect" label="POWERING SMART SCHOOLS." />
              <Metric value="Report Lab" label="STUDENT REPORTS FASTER." />
              <Metric value="Smart Pages" label="HANDWRITTEN DOCS TO READY PDFS." />
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="marketing-card-motion overflow-hidden rounded-[1.5rem] border border-white/30 bg-white/95 p-2 shadow-xl backdrop-blur">
              <div className="mb-2 px-2 pt-1.5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Full system walkthrough</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">Click to watch the full system walkthrough.</p>
              </div>
              <a href={BOOK_DEMO_URL} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-[1rem] border border-slate-200 bg-slate-100 text-left">
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
                    <p className="mt-0.5 text-xs font-semibold text-slate-600">10-minute demo - Report Lab + Smart Pages</p>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 px-4 pb-6 sm:px-6 lg:hidden">
        <Metric value="School Connect" label="POWERING SMART SCHOOLS." />
        <Metric value="Report Lab" label="STUDENT REPORTS FASTER." />
        <Metric value="Smart Pages" label="HANDWRITTEN DOCS TO READY PDFS." />
      </section>

      <section id="report-lab" className="border-b border-slate-200 bg-white px-4 py-6 lg:py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Report Lab</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              A smarter way to prepare school reports.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Report Lab helps schools move from manual marksheets and formatting delays to clean, professional student reports. Upload marks, review results, generate reports, print them, and share parent-ready links from one guided workflow.
            </p>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <MarketingFeatureCard step={1} title="Upload marks" body="Bring marks into the system by class, stream, subject, and term." icon={<FileTextIcon className="h-5 w-5" />} tone="blue" />
            <MarketingFeatureCard step={2} title="Generate reports" body="Create professional student reports with grades, remarks, summaries, and school-ready presentation." icon={<SparklesIcon className="h-5 w-5" />} tone="slate" />
            <MarketingFeatureCard step={3} title="Print and share" body="Print, download, or share secure parent links when the school is ready." icon={<ShieldIcon className="h-5 w-5" />} tone="emerald" />
          </div>
        </div>
      </section>

      <section id="smart-pages" className="border-b border-slate-200 bg-slate-50 px-4 py-6 lg:py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Smart Pages</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              From handwritten school documents to ready-to-print PDFs.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Upload a handwritten note, scanned letter, form, table, or school document. Smart Pages reads it, cleans it, formats it, and helps you produce a polished PDF you can print or share without typing it all again.
            </p>

            <div className="mt-3.5 flex flex-col gap-3 sm:flex-row">
              <Link to="/pricing" className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25">
                See pricing
              </Link>
              <Link to="/contact" className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
                Contact us
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

      <section className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">School Connect</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">A wider school workspace.</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                One product family, one product story, and room to grow into attendance, identity, and student workflow tools.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Coming soon</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">NFC wristbands and Kids Wallet.</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                The credential and wallet foundations are being shaped for school safety, access, and controlled spending.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Real-world demos</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Clear previews before a rollout.</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Schools can review the workflow and ask for the package that fits their setup.
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
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Ready to choose the right package?</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Book a short demo and we&apos;ll recommend the best School Connect setup for your school.
              </h2>
            </div>
            <div className="grid gap-3 lg:col-span-4">
              <a href={BOOK_DEMO_URL} target="_blank" rel="noreferrer" className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-center text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25">
                Request demo on WhatsApp
              </a>
              <Link to="/products" className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
                Browse products
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Direct line</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">Fast replies on WhatsApp</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">WhatsApp</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">+971 56 370 4103</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Support level</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">Matched after the demo call</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
