import { Link } from "react-router-dom";
import { buildWhatsAppUrl } from "../config/contact";
import { CheckIcon } from "../components/marketing/Icons";

const NFC_VIDEO_ID = "nU4EvHCn0U0";

// ── WhatsApp CTAs ──────────────────────────────────────────────────────────────

const NFC_QUOTE_WA = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies, I would like a quotation for School Connect NFC for our school. Please share requirements and pricing.",
);

const BOOK_DEMO_WA = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I'd like to book a product demo for my organisation.",
);

// ── Feature cards data ─────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: "🚪",
    title: "Gate Security",
    body: "Tap the student wristband at the school gate to confirm access, detect blocked or inactive records, and keep a digital gate log.",
    color: "#0F5BD8",
    bg: "#EAF3FF",
  },
  {
    icon: "✅",
    title: "Attendance",
    body: "Teachers or authorized staff can capture tap-in and tap-out attendance without paper registers.",
    color: "#16A34A",
    bg: "#DCFCE7",
  },
  {
    icon: "💳",
    title: "Kids Wallet & Canteen",
    body: "Students can make controlled school canteen payments using their NFC wristband or card. Wallet activity is recorded in the school system.",
    color: "#0F5BD8",
    bg: "#EAF3FF",
    note: "Kids Wallet is a closed school ledger for internal school spending. It is not a bank account.",
  },
  {
    icon: "📡",
    title: "Offline Mode",
    body: "If internet drops, prepared devices can continue scanning locally and sync safely when the connection returns.",
    color: "#7C3AED",
    bg: "#F5F3FF",
  },
  {
    icon: "🛡️",
    title: "Role-Based Access",
    body: "Cashiers, gate security, and administrators only see the tools they are allowed to use.",
    color: "#0F5BD8",
    bg: "#EAF3FF",
  },
  {
    icon: "📋",
    title: "Audit Trail",
    body: "Every scan, charge, top-up, and important action is recorded for accountability.",
    color: "#B45309",
    bg: "#FEF3C7",
  },
];

const USE_CASES = [
  "School Gate Access",
  "Attendance Tap-In / Tap-Out",
  "Canteen Payments",
  "Kids Wallet",
  "Library Book Issuing",
  "Student Identification",
  "Offline School Operations",
];

const PRICING_BULLETS = [
  "NFC student identity setup",
  "Gate access scanning",
  "Attendance tap-in / tap-out",
  "Kids Wallet and canteen workflows",
  "Offline-ready scanning",
  "Admin dashboard and audit logs",
  "Role-based staff access",
  "Training and deployment support",
];

// ── Components ─────────────────────────────────────────────────────────────────

function FeatureCard({
  icon,
  title,
  body,
  note,
  color,
  bg,
}: {
  icon: string;
  title: string;
  body: string;
  note?: string;
  color: string;
  bg: string;
}) {
  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      style={{ borderColor: "#D8E2F0" }}
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-xl"
        style={{ background: bg }}
      >
        {icon}
      </div>
      <h3 className="text-base font-extrabold text-slate-950">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
      {note && (
        <p className="mt-2 text-[11px] leading-4 text-slate-400 italic">{note}</p>
      )}
    </article>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function NfcPage() {
  return (
    <div className="bg-slate-50 text-slate-950">
      {/* ── SEO handled via route head (if needed externally) ── */}

      {/* ── Hero ── */}
      <section
        className="nfc-hero-image-bg site-hero-compact border-b text-white"
        style={{ borderColor: "rgba(15,91,216,0.3)" }}
      >
        <div className="absolute inset-0 bg-dot-grid opacity-[0.12]" />
        <div className="home-hero-content mx-auto grid max-w-7xl items-center gap-8 px-4 sm:px-6 lg:gap-12 lg:px-8 md:grid-cols-[1.05fr_0.95fr]">

          {/* ── Left: text ── */}
          <div>
            <div className="marketing-fade-up inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-50">
              School Connect · NFC
            </div>
            <h1 className="marketing-fade-up-delay-1 mt-2 hero-title font-black text-white">
              One Tap. Attendance, Gate Access, Canteen Wallets, and More.
            </h1>
            <p className="marketing-fade-up-delay-2 mt-2.5 text-sm leading-6 text-blue-50 sm:text-base">
              School Connect NFC helps schools manage student access, attendance, cashless canteen payments, and smart identity using NFC wristbands, cards, or tags — with online and offline-ready workflows.
            </p>
            <div className="marketing-fade-up-delay-3 mt-5 flex flex-col gap-3 sm:flex-row">
              <a
                href={NFC_QUOTE_WA}
                target="_blank"
                rel="noreferrer"
                className="btn marketing-button-motion rounded-xl bg-white px-5 py-3 text-sm font-black text-blue-700 shadow-lg hover:bg-blue-50"
              >
                Request NFC Quotation
              </a>
              <a
                href={BOOK_DEMO_WA}
                target="_blank"
                rel="noreferrer"
                className="btn marketing-button-motion rounded-xl border border-blue-500 bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow md:border-white/30 md:bg-white/10 md:shadow-none md:hover:bg-white/20"
              >
                Book a Demo
              </a>
            </div>

            {/* Quick stat chips */}
            <div className="mt-6 flex flex-wrap gap-2">
              {["Gate Security", "Attendance", "Canteen Wallet", "Offline-Ready", "Audit Trail"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/25 bg-white/95 px-3 py-1 text-[11px] font-bold text-blue-900 shadow-sm md:bg-white/10 md:text-white md:shadow-none"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* ── Right: video card (stacks below text on mobile) ── */}
          <div className="flex justify-center">
            <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl bg-white p-2 shadow-xl ring-1 ring-blue-100">
              <div className="mb-2 px-2 pt-1.5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Watch NFC In Action</p>
                <p className="mt-1 text-sm leading-5 text-slate-600">Canteen, gate access, attendance, and offline-ready scanning.</p>
              </div>
              <div className="aspect-[9/16] w-full overflow-hidden rounded-[1rem]">
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${NFC_VIDEO_ID}?rel=0&modestbranding=1`}
                  title="School Connect NFC Demo"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── What is School Connect NFC? ── */}
      <section className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">What is School Connect NFC?</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                Smart student identity for the whole school.
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                School Connect NFC is a smart student identification and operations system for schools. Each student can receive an NFC wristband, card, or tag linked to their school profile. Staff can tap the NFC item using a supported phone or reader to confirm identity, record attendance, manage gate access, process canteen wallet payments, and support other school workflows.
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                The system is built for real school environments where speed, security, and reliability matter. It supports role-based staff access, audit trails, student wallet controls, and offline-ready scanning so daily operations can continue even when internet connection is unstable.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <a
                  href={NFC_QUOTE_WA}
                  target="_blank"
                  rel="noreferrer"
                  className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl"
                >
                  Request Quotation
                </a>
                <Link
                  to="/pricing"
                  className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-5 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50"
                >
                  View NFC Pricing
                </Link>
              </div>
            </div>

            {/* NFC hero image */}
            <div className="lg:col-span-6">
              <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-xl">
                <img
                  src="/images/nfc-wristband-hero.png"
                  alt="Student using NFC wristband at school gate — One Tap. Access Granted."
                  className="w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section className="border-b border-slate-200 bg-slate-50 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Features</p>
            <h2 className="mt-1.5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Everything a school needs from NFC.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Used For ── */}
      <section className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Used For</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                One wristband. Many school workflows.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                School Connect NFC is flexible enough to power different school entry points — from the gate to the canteen, library, and classroom.
              </p>
              <a
                href={NFC_QUOTE_WA}
                target="_blank"
                rel="noreferrer"
                className="btn marketing-button-motion mt-5 inline-flex rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20"
              >
                Get a Quotation
              </a>
            </div>
            <div className="lg:col-span-7">
              <div className="grid gap-3 sm:grid-cols-2">
                {USE_CASES.map((useCase) => (
                  <div
                    key={useCase}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: "#EAF3FF", color: "#0F5BD8" }}
                    >
                      <CheckIcon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold text-slate-800">{useCase}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Works With ── */}
      <section className="border-b border-slate-200 bg-slate-50 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Works With</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                Flexible hardware, built around your school.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                School Connect NFC can work with NFC wristbands, cards, or tags. Schools can use supported Android phones or NFC readers depending on the workflow and environment.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Hardware requirements depend on the school size, number of students, gate points, canteen counters, and preferred NFC items.
              </p>
            </div>
            <div className="lg:col-span-5">
              <div className="grid gap-3">
                {[
                  { label: "NFC Wristbands", note: "Comfortable, durable, waterproof" },
                  { label: "NFC Cards", note: "Familiar credit-card form factor" },
                  { label: "NFC Tags / Stickers", note: "For books, lockers, and flexible use" },
                  { label: "Supported Android Phones", note: "Web NFC scanning — no app required" },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
                    <span
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      style={{ background: "#EAF3FF" }}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: "#0F5BD8" }} />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-950">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── NFC Pricing Card ── */}
      <section className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Pricing</p>
            <h2 className="mt-1.5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              School Connect NFC — By Quotation
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
            {/* Pricing card */}
            <div className="lg:col-span-5">
              <article className="relative overflow-hidden rounded-2xl border border-blue-200 bg-white p-6 shadow-md ring-1 ring-blue-100">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-300" />
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-700">School Connect NFC</p>
                <p className="mt-3 text-4xl font-black tracking-tight text-slate-950">By Quotation</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Pricing depends on the number of students, NFC wristbands/cards/tags, devices, modules selected, setup, training, and support needs.
                </p>

                <ul className="mt-5 space-y-2">
                  {PRICING_BULLETS.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                      {b}
                    </li>
                  ))}
                </ul>

                <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                  NFC hardware and setup are quoted based on school requirements. Setup fee applies.
                </p>

                <a
                  href={NFC_QUOTE_WA}
                  target="_blank"
                  rel="noreferrer"
                  className="btn marketing-button-motion mt-5 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-center text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl"
                >
                  Request Quotation
                </a>
                <a
                  href={BOOK_DEMO_WA}
                  target="_blank"
                  rel="noreferrer"
                  className="btn marketing-button-motion mt-3 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-center text-sm font-bold text-blue-700 hover:bg-blue-50"
                >
                  Book a Demo
                </a>
              </article>
            </div>

            {/* Why By Quotation */}
            <div className="lg:col-span-7">
              <h3 className="text-lg font-black text-slate-950">Why is NFC priced by quotation?</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Every school has a different number of students, gate points, canteen counters, and NFC hardware preferences. A small primary school with 200 students needs a different setup from a 1,500-student secondary school with multiple gate access points and canteen terminals.
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                We size the software modules, hardware, setup support, and training specifically to match your school's actual needs — so you only pay for what you use.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Student Count", note: "Drives NFC item quantity and wallet capacity" },
                  { label: "Gate Points", note: "Number of entry/exit points to scan" },
                  { label: "Canteen Counters", note: "How many charging terminals are needed" },
                  { label: "Modules Selected", note: "Gate, attendance, canteen, or full suite" },
                  { label: "Hardware Type", note: "Wristbands, cards, or tags" },
                  { label: "Training & Support", note: "On-site or remote setup support" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                    <p className="text-xs font-bold text-slate-950">{item.label}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{item.note}</p>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs text-slate-400">
                Launch offer may apply to selected School Connect software modules. NFC hardware and setup are quoted separately.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="border-t border-slate-200 bg-blue-50/40 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-blue-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Ready to set up NFC for your school?</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                One tap. A smarter school every day.
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Contact us on WhatsApp to start a quotation. We'll ask a few questions about your school and prepare a package that fits.
              </p>
            </div>
            <div className="grid gap-3 lg:col-span-4">
              <a
                href={NFC_QUOTE_WA}
                target="_blank"
                rel="noreferrer"
                className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-center text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl"
              >
                Request NFC Quotation
              </a>
              <a
                href={BOOK_DEMO_WA}
                target="_blank"
                rel="noreferrer"
                className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-center text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
              >
                Book a Demo
              </a>
              <Link
                to="/pricing"
                className="btn marketing-button-motion rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
              >
                View All Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
