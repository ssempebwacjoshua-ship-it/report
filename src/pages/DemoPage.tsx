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
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
      <p className="text-lg font-black text-white">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-slate-300">{label}</p>
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
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => void navigate("/demo")}
            className="flex items-center gap-3 text-left"
          >
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-slate-950 shadow-lg shadow-blue-500/10">
              <SchoolIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black tracking-tight text-white">School Connect</p>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Report Lab</p>
            </div>
          </button>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-300 md:flex">
            <a href="#report-lab" className="transition hover:text-white">Report Lab</a>
            <a href="#smart-pages" className="transition hover:text-white">Smart Pages</a>
            <a href="#proof" className="transition hover:text-white">Proof</a>
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={() => void navigate("/login")}
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-slate-200 transition hover:border-white/25 hover:bg-white/5"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => void navigate(reportLabTarget)}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-slate-100"
            >
              Try Report Lab
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((current) => !current)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white md:hidden"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-white/10 bg-slate-950 px-4 py-4 md:hidden">
            <div className="grid gap-2">
              <a
                href="#report-lab"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200"
              >
                Report Lab
              </a>
              <a
                href="#smart-pages"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200"
              >
                Smart Pages
              </a>
              <button
                type="button"
                onClick={() => void navigate("/login")}
                className="rounded-2xl border border-white/10 px-4 py-3 text-left text-sm font-semibold text-slate-200"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => void navigate(reportLabTarget)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
              >
                Try Report Lab
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 bg-dot-grid opacity-[0.12]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.2),rgba(2,6,23,0.85))]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-20">
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-200">
                <SparklesIcon className="h-3.5 w-3.5" />
                Public demo for Report Lab and Smart Pages
              </div>
              <h1 className="mt-5 max-w-xl text-4xl font-black tracking-tight text-white sm:text-5xl">
                Turn school work into polished reports, faster.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                School Connect brings report generation, marks import, and Smart Pages into one
                production app. This landing page is a public entry point into the real product
                flow, not a separate sandbox.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void navigate("/login")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-slate-950 transition hover:bg-slate-100"
                >
                  Open Demo
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void navigate(reportLabTarget)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Try Report Lab
                </button>
                <button
                  type="button"
                  onClick={() => void navigate(smartPagesTarget)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-300/30 bg-blue-400/10 px-5 py-3.5 text-sm font-bold text-blue-100 transition hover:bg-blue-400/15"
                >
                  Smart Pages
                </button>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Metric value="Report Lab" label="Real production routes" />
                <Metric value="Smart Pages" label="Public landing entry" />
                <Metric value="Mobile first" label="Responsive on small screens" />
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-3 shadow-2xl shadow-black/30">
                <img
                  src={solutionImage}
                  alt="Digital school report dashboard on tablet and phone"
                  className="aspect-[4/3] w-full rounded-[1.25rem] object-cover"
                  loading="eager"
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-3">
                  <img
                    src={problemImage}
                    alt="Manual paperwork and records stacked on a desk"
                    className="aspect-[4/3] w-full rounded-[1rem] object-cover"
                  />
                  <p className="mt-3 text-sm font-bold text-white">Before</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">
                    Manual work, scattered files, and slow report preparation.
                  </p>
                </div>
                <div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-3">
                  <div className="grid aspect-[4/3] place-items-center rounded-[1rem] border border-emerald-300/15 bg-slate-950/60">
                    <div className="grid gap-3 text-center">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-200">
                        <CheckCircleIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white">Production-ready flow</p>
                        <p className="mt-1 text-sm leading-6 text-emerald-100/80">
                          Generate, review, publish, and print from the live app.
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-bold text-white">After</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">
                    Structured reports and Smart Pages connected to the existing system.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="report-lab" className="border-b border-slate-200 bg-slate-50 px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Report Lab</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Keep report work inside the product you already run.
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Report Lab stays focused on students, marks import, reports, release, and print.
                These are the routes already wired into the production app.
              </p>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              <SectionCard
                icon={<FileTextIcon className="h-5 w-5" />}
                title="Generate reports"
                body="Move from marks and comments to a printable report workflow without switching apps."
              />
              <SectionCard
                icon={<PrinterIcon className="h-5 w-5" />}
                title="Release and print"
                body="Send reports through the existing release center and print paths."
                accent="slate"
              />
              <SectionCard
                icon={<LockIcon className="h-5 w-5" />}
                title="Protected routes"
                body="Authenticated app screens remain behind the current login and AppShell."
                accent="emerald"
              />
            </div>
          </div>
        </section>

        <section id="smart-pages" className="border-b border-slate-200 bg-white px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Smart Pages</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                The public page can lead straight into Smart Pages when the user is ready.
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Smart Pages stays in the real route tree. If the user is already signed in, we send
                them there directly. Otherwise we send them to the existing login screen first.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void navigate(smartPagesTarget)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white transition hover:bg-slate-800"
                >
                  Go to Smart Pages
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
              <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                        <GridIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-950">Upload and extract</p>
                        <p className="text-sm text-slate-500">Keep the live extraction flow intact.</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <BookIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-950">Review and publish</p>
                        <p className="text-sm text-slate-500">Use the same editing and publish routes.</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                        <SmartphoneIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-950">Responsive by default</p>
                        <p className="text-sm text-slate-500">Same experience on mobile and desktop.</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                        <ShieldIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-950">No fake dashboard</p>
                        <p className="text-sm text-slate-500">The landing page only links to real routes.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="proof" className="bg-slate-950 px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30 sm:p-8">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-8">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">Proof</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-white">
                  The public page is just a front door.
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                  The Report Lab and Smart Pages routes, authentication, backend, Prisma, and tests
                  remain unchanged. This integration only adds a public entry page and uses the live
                  application paths you already have.
                </p>
              </div>
              <div className="lg:col-span-4 lg:text-right">
                <button
                  type="button"
                  onClick={() => void navigate("/login")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-slate-950 transition hover:bg-slate-100"
                >
                  Sign in
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
