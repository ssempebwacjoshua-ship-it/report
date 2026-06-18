import { type ReactNode, type SVGProps, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import problemImage from "../assets/images/problems_manual_chaos_1781722176857.jpg";
import solutionImage from "../assets/images/solutions_report_lab_digital_1781722193278.jpg";

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
    <div className="premium-card rounded-2xl px-4 py-3">
      <p className="text-lg font-black text-blue-700">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  body,
  accent = "blue",
}: {
  icon: ReactNode;
  title: string;
  body: string;
  accent?: "blue" | "emerald" | "slate";
}) {
  const accentClass =
    accent === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : accent === "slate"
        ? "border-slate-200 bg-slate-50 text-slate-700"
        : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <div className="premium-card premium-card-hover rounded-3xl p-5">
      <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${accentClass}`}>
        {icon}
      </div>
      <h3 className="text-base font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

export function DemoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const reportLabTarget = user ? "/dashboard" : "/login";
  const smartPagesTarget = user ? "/smart-pages" : "/login";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
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
            <a href="#why-school-connect" className="transition hover:text-blue-700">Why School Connect</a>
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={() => void navigate("/login")}
              className="btn btn-secondary rounded-full px-4 py-2 text-sm font-bold"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => void navigate(reportLabTarget)}
              className="btn btn-primary rounded-full px-4 py-2 text-sm font-black"
            >
              Launch Demo
              <ArrowRightIcon className="h-4 w-4" />
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
                className="btn btn-secondary rounded-2xl px-4 py-3 text-left text-sm font-semibold"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => void navigate(reportLabTarget)}
                className="btn btn-primary rounded-2xl px-4 py-3 text-sm font-black"
              >
                Launch Demo
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-white via-blue-50 to-slate-50">
          <div className="absolute inset-0 bg-dot-grid opacity-[0.25]" />
          <div className="relative mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-12">
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">
                <SparklesIcon className="h-3.5 w-3.5" />
                School Connect for smart schools
              </div>
              <h1 className="mt-3 max-w-xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Powering smart schools with digital reports and intelligent documents.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                School Connect is a growing digital workspace for modern schools. Start with
                Report Lab and Smart Pages - two powerful tools that help schools reduce
                paperwork, speed up reporting, and turn school documents into clean digital
                workflows.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void navigate("/login")}
                  className="btn btn-primary rounded-2xl px-5 py-3.5 text-sm font-black"
                >
                  Launch Demo
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void navigate(reportLabTarget)}
                  className="btn btn-secondary rounded-2xl px-5 py-3.5 text-sm font-bold"
                >
                  Explore Report Lab
                </button>
                <button
                  type="button"
                  onClick={() => void navigate(smartPagesTarget)}
                  className="btn btn-secondary rounded-2xl border-slate-200 px-5 py-3.5 text-sm font-bold text-slate-700"
                >
                  Explore Smart Pages
                </button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Metric value="School Connect" label="Powering smart schools." />
                <Metric value="Report Lab" label="Generate student reports faster." />
                <Metric value="Smart Pages" label="Handwritten docs to ready PDFs." />
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-2.5 shadow-sm">
                <div className="mb-3 px-2 pt-2">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                    Full System Walkthrough
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Watch a 10-minute demo of School Connect, Report Lab, Smart Pages, and the
                    smart school workflow.
                  </p>
                </div>

                <div className="overflow-hidden rounded-[1rem] border border-slate-200 bg-slate-100">
                  <iframe
                    className="aspect-video w-full"
                    src="https://www.youtube-nocookie.com/embed/jZrp-jOhjwo?rel=0&modestbranding=1"
                    title="School Connect full system walkthrough"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-2.5 shadow-sm">
                  <img
                    src={problemImage}
                    alt="Manual paperwork and records stacked on a desk"
                    className="aspect-[4/3] w-full rounded-[1rem] object-cover"
                  />
                  <p className="mt-2 text-sm font-bold text-slate-950">Before</p>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    Manual work, scattered files, and slow report preparation.
                  </p>
                </div>
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-2.5 shadow-sm">
                  <div className="grid aspect-[4/3] place-items-center rounded-[1rem] border border-emerald-100 bg-white">
                    <div className="grid gap-2.5 text-center">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <CheckCircleIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-950">Production-ready flow</p>
                        <p className="mt-1 text-sm leading-5 text-slate-600">
                          Generate, review, publish, and print from the live app.
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-950">After</p>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    Structured reports and Smart Pages connected to the existing system.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="report-lab" className="border-b border-slate-200 bg-white px-4 py-9 lg:py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">REPORT LAB</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                A smarter way to prepare school reports.
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Report Lab is a School Connect product built to help schools move from manual
                marksheets and formatting delays to clean, professional student reports. Upload
                marks, review results, generate reports, print them, and share parent-ready links
                from one guided workflow.
              </p>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <SectionCard
                icon={<FileTextIcon className="h-5 w-5" />}
                title="Upload marks"
                body="Bring marks into the system by class, stream, subject, and term."
              />
              <SectionCard
                icon={<PrinterIcon className="h-5 w-5" />}
                title="Generate reports"
                body="Create professional student reports with grades, remarks, summaries, and school-ready presentation."
                accent="slate"
              />
              <SectionCard
                icon={<LockIcon className="h-5 w-5" />}
                title="Print and share"
                body="Print, download, or share secure parent links when the school is ready."
                accent="emerald"
              />
            </div>
          </div>
        </section>

        <section id="smart-pages" className="border-b border-slate-200 bg-blue-50/50 px-4 py-9 lg:py-10 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">SMART PAGES</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                From handwritten school documents to ready-to-print PDFs.
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Upload a handwritten note, scanned letter, form, table, or school document. Smart
                Pages reads it, cleans it, formats it, and helps you produce a polished PDF you can
                print or share - without typing it all again.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void navigate(smartPagesTarget)}
                  className="btn btn-primary rounded-2xl px-5 py-3.5 text-sm font-black"
                >
                  Explore Smart Pages
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void navigate("/login")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Sign in
                </button>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                        <GridIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-950">Upload handwriting</p>
                        <p className="text-sm leading-5 text-slate-500">Upload handwritten or scanned school documents.</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <BookIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-950">Read and clean</p>
                        <p className="text-sm leading-5 text-slate-500">Let Smart Pages extract the important content and organize it clearly.</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                        <SmartphoneIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-950">Format professionally</p>
                        <p className="text-sm leading-5 text-slate-500">Turn rough school notes into clean, structured pages.</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                        <ShieldIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-950">Print or share</p>
                        <p className="text-sm leading-5 text-slate-500">Generate a ready PDF for printing, downloading, or sharing.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="why-school-connect" className="bg-slate-50 px-4 py-9 lg:py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2rem] border border-slate-200 bg-gradient-to-br from-blue-600 to-blue-700 p-6 shadow-lg sm:p-8">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-8">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-100">WHY SCHOOL CONNECT</p>
                <h2 className="mt-1 text-3xl font-black tracking-tight text-white">
                  One platform, growing with your school.
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-blue-50">
                  School Connect starts with practical tools schools need today - Report Lab for
                  academic reporting and Smart Pages for intelligent documents. More smart school
                  workflows can be added as the school grows.
                </p>
              </div>
              <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
                <button
                  type="button"
                  onClick={() => void navigate(reportLabTarget)}
                  className="btn rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-blue-700 hover:bg-blue-50"
                >
                  Launch Demo
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void navigate("/login")}
                  className="btn rounded-2xl border border-blue-100 bg-white px-5 py-3.5 text-sm font-bold text-blue-700 hover:bg-blue-50"
                >
                  Sign in
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
