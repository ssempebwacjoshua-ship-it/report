import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { FaqSection } from "../components/marketing/FaqSection";
import { buildWhatsAppUrl } from "../config/contact";
import { RENTFLOW_FAQS } from "../content/discoverability";
import {
  BuildingIcon,
  CashIcon,
  DocumentIcon,
  HomeIcon,
  OfficeIcon,
  PhoneIcon,
  PrinterIcon,
  SmartphoneIcon,
  WrenchIcon,
} from "../components/marketing/Icons";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I would like to book a RentFlow demo for my property portfolio.",
);

const HERO_METRICS = [
  { label: "Occupancy", value: "92%" },
  { label: "Bookings today", value: "14" },
  { label: "Payments collected", value: "UGX 4.8m" },
  { label: "Pending balances", value: "UGX 1.2m" },
  { label: "Cleaning tasks", value: "3" },
  { label: "Checkout balance", value: "UGX 420k" },
] as const;

const HERO_FEATURES = [
  { title: "Bookings", note: "Check-ins and stays" },
  { title: "Tenants", note: "Lease records" },
  { title: "Payments", note: "Rent and deposit tracking" },
  { title: "Deposits", note: "Clear balances" },
  { title: "Maintenance", note: "Open tasks" },
  { title: "Owner Statements", note: "Month-end reporting" },
] as const;

const WORKFLOW_STEPS = [
  {
    step: 1,
    title: "Add property and units",
    body: "Create a portfolio, add rooms or shops, and keep every unit visible in one clean screen.",
    icon: <BuildingIcon className="h-5 w-5" />,
    preview: (
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
        <div className="relative h-36 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_45%,rgba(2,6,23,0.18)_100%)]" />
          <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
            <span>Kampala Heights</span>
          </div>
          <BuildingIcon className="absolute right-3 top-3 h-10 w-10 text-white/20" />
          <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/10 bg-slate-950/72 p-3 shadow-[0_10px_24px_rgba(2,8,23,0.25)] backdrop-blur-sm">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-blue-100">
              <span>Unit overview</span>
              <span>12 units</span>
            </div>
            <div className="mt-2 grid grid-cols-6 gap-1.5">
              <div className="h-8 rounded-md bg-white/20" />
              <div className="h-8 rounded-md bg-white/12" />
              <div className="h-8 rounded-md bg-white/16" />
              <div className="h-8 rounded-md bg-white/12" />
              <div className="h-8 rounded-md bg-white/18" />
              <div className="h-8 rounded-md bg-white/12" />
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    step: 2,
    title: "Record bookings or tenants",
    body: "Capture check-ins, leases, and move-in dates without splitting short-stay and long-stay workflows.",
    icon: <PhoneIcon className="h-5 w-5" />,
    preview: (
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
        <div className="relative h-36 bg-gradient-to-br from-blue-950 via-blue-800 to-cyan-500">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_55%)]" />
          <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
            <span>Today</span>
          </div>
          <div className="absolute right-3 top-3 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
            3 check-ins
          </div>
          <div className="absolute left-4 right-4 top-12 grid grid-cols-7 gap-1 opacity-35">
            {Array.from({ length: 21 }).map((_, index) => (
              <div key={`booking-cell-${index}`} className="h-3 rounded-sm bg-white/40" />
            ))}
          </div>
          <div className="absolute inset-x-3 bottom-3 space-y-2 rounded-2xl border border-white/10 bg-white/92 p-3 shadow-[0_10px_24px_rgba(2,8,23,0.22)]">
            <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
              <span>Room 4B</span>
              <span className="text-blue-700">Booked</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
              <span>Unit 2A</span>
              <span className="text-emerald-600">Arriving</span>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    step: 3,
    title: "Track payments and deposits",
    body: "See rent, deposit, and balance movement together so nothing gets lost in spreadsheets.",
    icon: <CashIcon className="h-5 w-5" />,
    preview: (
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
        <div className="relative h-36 bg-gradient-to-br from-slate-950 via-emerald-700 to-emerald-400">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.2),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_58%)]" />
          <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
            <span>Collected</span>
          </div>
          <div className="absolute right-3 top-3 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
            65%
          </div>
          <div className="absolute left-4 right-4 top-12 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
            <div className="h-2 rounded-full bg-white/22">
              <div className="h-full w-[65%] rounded-full bg-gradient-to-r from-white to-emerald-200" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-white">
              <div className="rounded-xl border border-white/10 bg-white/12 px-3 py-2 shadow-sm">Rent</div>
              <div className="rounded-xl border border-white/10 bg-white/12 px-3 py-2 shadow-sm">Deposit</div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    step: 4,
    title: "Generate checkout bills and owner statements",
    body: "Close out each stay with a bill, a balance summary, and an owner-ready statement.",
    icon: <PrinterIcon className="h-5 w-5" />,
    preview: (
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
        <div className="relative h-36 bg-gradient-to-br from-slate-950 via-amber-700 to-orange-400">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_58%)]" />
          <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
            <DocumentIcon className="h-3.5 w-3.5" />
            <span>Ready to send</span>
          </div>
          <div className="absolute inset-x-4 top-12">
            <div className="relative mx-auto max-w-[170px] rounded-2xl border border-white/15 bg-white/95 p-3 shadow-[0_14px_26px_rgba(2,8,23,0.25)]">
              <div className="h-2 w-16 rounded-full bg-slate-200" />
              <div className="mt-3 space-y-2">
                <div className="h-2.5 rounded-full bg-slate-200/80" />
                <div className="h-2.5 rounded-full bg-slate-200/80" />
                <div className="h-2.5 w-4/5 rounded-full bg-slate-200/80" />
              </div>
            </div>
          </div>
          <div className="absolute inset-x-3 bottom-3 space-y-2 rounded-2xl border border-white/10 bg-white/92 p-3 shadow-[0_10px_24px_rgba(2,8,23,0.22)]">
            <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">Checkout bill</div>
            <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">Owner statement</div>
          </div>
        </div>
      </div>
    ),
  },
] as const;

const RENTFLOW_VISUALS = [
  {
    title: "Short-stay / Airbnb",
    body: "Fast booking, quick turnover, and simple occupancy tracking for busy hosts.",
    icon: <HomeIcon className="h-5 w-5" />,
    bg: "bg-blue-50",
    accent: "text-blue-700",
  },
  {
    title: "Residential rentals",
    body: "Lease records, rent reminders, and clear tenant history for longer stays.",
    icon: <BuildingIcon className="h-5 w-5" />,
    bg: "bg-slate-50",
    accent: "text-slate-700",
  },
  {
    title: "Commercial shops & offices",
    body: "Track shop units, office occupancy, and portfolio-level payment status.",
    icon: <OfficeIcon className="h-5 w-5" />,
    bg: "bg-blue-50",
    accent: "text-blue-700",
  },
  {
    title: "Owner statements",
    body: "Prepare clear summaries owners can review without extra back-and-forth.",
    icon: <DocumentIcon className="h-5 w-5" />,
    bg: "bg-amber-50",
    accent: "text-amber-700",
  },
  {
    title: "Payments / deposits",
    body: "See collected amounts, pending balances, and deposit movement at a glance.",
    icon: <CashIcon className="h-5 w-5" />,
    bg: "bg-emerald-50",
    accent: "text-emerald-700",
  },
  {
    title: "Cleaning / maintenance",
    body: "Keep turnovers visible and assign follow-up work before the next arrival.",
    icon: <WrenchIcon className="h-5 w-5" />,
    bg: "bg-slate-50",
    accent: "text-slate-700",
  },
] as const;

const DEVICE_CHECKS = [
  { label: "Light status", value: "ON" },
  { label: "TV socket", value: "OFF" },
  { label: "Checkout rule", value: "Auto-off at checkout" },
  { label: "Critical warning", value: "Needs operator review" },
] as const;

const PRICING_PLANS = [
  {
    name: "Starter",
    unitLimit: "Up to 10 units",
    monthlyPrice: "UGX 120,000 / mo",
    setupFee: "UGX 250,000 setup fee",
    ctaLabel: "Choose Starter",
    featured: false,
  },
  {
    name: "Standard",
    unitLimit: "Up to 25 units",
    monthlyPrice: "UGX 220,000 / mo",
    setupFee: "UGX 400,000 setup fee",
    ctaLabel: "Choose Standard",
    featured: true,
  },
  {
    name: "Growth",
    unitLimit: "Up to 60 units",
    monthlyPrice: "UGX 390,000 / mo",
    setupFee: "UGX 650,000 setup fee",
    ctaLabel: "Choose Growth",
    featured: false,
  },
  {
    name: "Business",
    unitLimit: "Up to 120 units",
    monthlyPrice: "UGX 650,000 / mo",
    setupFee: "UGX 900,000 setup fee",
    ctaLabel: "Choose Business",
    featured: false,
  },
  {
    name: "Enterprise",
    unitLimit: "Large portfolios",
    monthlyPrice: "Custom monthly quote",
    setupFee: "Tailored setup fee",
    ctaLabel: "Request Enterprise Quote",
    featured: false,
  },
] as const;

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function WorkflowCard({
  step,
  title,
  body,
  icon,
  preview,
}: {
  step: number;
  title: string;
  body: string;
  icon: ReactNode;
  preview: ReactNode;
}) {
  return (
    <article className="motion-card motion-card-stagger relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-300" />
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">
          Step {String(step).padStart(2, "0")}
        </span>
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/20">
          {icon}
        </div>
      </div>
      <h3 className="mt-4 text-base font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
      {preview}
    </article>
  );
}

function VisualTile({
  title,
  body,
  icon,
  bg,
  accent,
}: {
  title: string;
  body: string;
  icon: ReactNode;
  bg: string;
  accent: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${bg} ${accent}`}>{icon}</div>
      <h3 className="mt-3 text-sm font-black text-slate-950">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-slate-600">{body}</p>
    </article>
  );
}

function PricingCard({
  name,
  unitLimit,
  monthlyPrice,
  setupFee,
  ctaLabel,
  featured,
}: {
  name: string;
  unitLimit: string;
  monthlyPrice: string;
  setupFee: string;
  ctaLabel: string;
  featured: boolean;
}) {
  return (
    <article
      className={[
        "motion-card motion-card-stagger relative flex h-full flex-col overflow-hidden rounded-[1.5rem] border bg-white p-5 shadow-sm transition hover:shadow-lg",
        featured ? "border-blue-300 ring-1 ring-blue-200" : "border-slate-200 hover:border-blue-200",
      ].join(" ")}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${featured ? "bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-300" : "bg-gradient-to-r from-slate-200 via-blue-100 to-slate-200"}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-700">{name}</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">{unitLimit}</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-slate-600">
          Launch offer
        </span>
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Monthly price</p>
        <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">{monthlyPrice}</p>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Setup fee</p>
        <p className="mt-1 text-sm font-black text-slate-700">{setupFee}</p>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
          <span>Units</span>
          <span>{unitLimit}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
          <span>Offer</span>
          <span>Launch offer</span>
        </div>
      </div>

      <a
        href={BOOK_DEMO_URL}
        target="_blank"
        rel="noreferrer"
        className={[
          "btn marketing-button-motion mt-5 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-black",
          featured
            ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25"
            : "border border-blue-200 bg-white text-blue-700 hover:bg-blue-50",
        ].join(" ")}
      >
        {ctaLabel}
      </a>
    </article>
  );
}

function DashboardPreview() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-slate-950 shadow-lg">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-700 via-blue-500 to-slate-300" />
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Portfolio dashboard</p>
          <h2 className="mt-1 text-base font-black tracking-tight text-slate-950">Daily operations at a glance</h2>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Status</p>
          <p className="mt-0.5 text-sm font-black text-slate-950">Live portfolio</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {HERO_METRICS.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
            <p className="mt-1 text-lg font-black tracking-tight text-slate-950">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Operational note</p>
          <DocumentIcon className="h-4 w-4 text-slate-700" />
        </div>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
          Owner statements are ready for month-end export, with cleaning and checkout work kept visible in the same dashboard.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-50 text-slate-700">
              <CashIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Pending balances</p>
              <p className="text-sm font-semibold text-slate-700">UGX 1.2m across 7 units</p>
            </div>
          </div>
        </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-50 text-slate-700">
                <WrenchIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Maintenance note</p>
              <p className="text-sm font-semibold text-slate-700">One guest-reported issue needs follow-up.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhonePreview() {
  return (
    <div className="mx-auto w-full max-w-[280px] rounded-[1.9rem] border border-slate-200 bg-slate-950 p-2.5 shadow-2xl">
      <div className="rounded-[1.6rem] bg-white p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">RentFlow PWA</p>
            <p className="mt-0.5 text-sm font-black text-slate-950">Today's bookings</p>
          </div>
          <SmartphoneIcon className="h-5 w-5 text-blue-700" />
        </div>
        <div className="mt-3 rounded-2xl bg-blue-50 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">Unit status</p>
          <p className="mt-1 text-sm font-black text-slate-950">4 ready, 2 occupied</p>
        </div>
        <div className="mt-3 space-y-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Payment balance</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-700">UGX 420,000 due</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Cleaning task</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-700">Suite 2A ready after checkout</p>
          </div>
        </div>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Quick actions</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
              Online
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-blue-50 px-2 py-2 text-center text-[11px] font-black text-blue-700">Check in</div>
            <div className="rounded-xl bg-amber-50 px-2 py-2 text-center text-[11px] font-black text-amber-700">Collect payment</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DevicePanel() {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-700">
          <WrenchIcon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Optional smart lights and sockets setup</p>
          <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Room-level device status in one place</h3>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Room / unit</p>
            <p className="mt-0.5 text-sm font-black text-slate-950">Suite 3B</p>
          </div>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">
            Occupied
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {DEVICE_CHECKS.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
              <p className="mt-1.5 text-sm font-black text-slate-950">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Wi-Fi smart lights and sockets are optional installation add-ons, quoted separately.
        </div>
      </div>
    </div>
  );
}

export function RentFlowPage() {
  return (
    <div className="bg-slate-50 text-slate-950">
      <section className="site-hero-blue site-hero-compact hero-rhythm border-b text-white" style={{ borderColor: "rgba(15,91,216,0.3)" }}>
        <div className="absolute inset-0 bg-dot-grid opacity-[0.08]" />
        <div className="home-hero-content mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:items-center lg:px-8">
          <div className="lg:col-span-7">
            <div className="marketing-fade-up inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-50">
              <BuildingIcon className="h-3.5 w-3.5" />
              SSAMENJ RentFlow
            </div>
            <h1 className="marketing-fade-up-delay-1 mt-3 max-w-2xl text-[2.1rem] font-black leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-[3.1rem]">
              Manage rentals, Airbnb rooms, shops, and apartments from one system.
            </h1>
            <p className="marketing-fade-up-delay-2 mt-3 max-w-2xl text-sm leading-7 text-blue-50 sm:text-base">
              SSAMENJ RentFlow helps property owners and managers track bookings, tenants, payments, deposits,
              maintenance, cleaning, owner statements, and checkout balances.
            </p>

            <div className="marketing-fade-up-delay-3 mt-5 flex flex-col gap-3 sm:flex-row">
              <a
                href={BOOK_DEMO_URL}
                target="_blank"
                rel="noreferrer"
                className="btn marketing-button-motion motion-cta rounded-xl bg-white px-4 py-3 text-sm font-black text-blue-700 shadow-sm hover:bg-slate-50"
              >
                Book a walkthrough
              </a>
              <Link
                to="/pricing"
                className="btn marketing-button-motion motion-cta rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15"
              >
                View pricing
              </Link>
              <Link
                to="/contact"
                className="btn marketing-button-motion motion-cta rounded-xl border border-white/20 bg-transparent px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Contact us
              </Link>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {HERO_FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="marketing-card-motion rounded-xl border border-white/15 bg-white/[0.08] px-3 py-2.5 transition-all duration-200 hover:border-white/25 hover:bg-white/[0.12]"
                >
                  <p className="text-sm font-black text-white">{feature.title}</p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-blue-100">{feature.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="relative">
              <DashboardPreview />
              <div className="mt-4 lg:absolute lg:-bottom-8 lg:right-3 lg:mt-0 lg:w-[232px]">
                <PhonePreview />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="What RentFlow covers"
            title="Built for property teams that need bookings, balances, and owner reporting in one system."
            description="Keep short-stay rentals, residential units, and commercial properties in one clear workflow without splitting the business across separate tools."
          />

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {WORKFLOW_STEPS.map((feature) => (
              <WorkflowCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Visual coverage"
            title="Use one product across every property type."
            description="RentFlow keeps the same clean flow whether you manage a few short-stay rooms or a mixed portfolio with residential and commercial units."
          />

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {RENTFLOW_VISUALS.map((item) => (
              <VisualTile key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-5">
              <SectionHeading
                eyebrow="Smart device add-ons"
                title="Optional smart lights and sockets setup"
                description="Show the room and device state in a simple operations view. This is an add-on concept, not a claim that vendor automation is universally live."
              />
            </div>
            <div className="lg:col-span-7">
              <DevicePanel />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <SectionHeading
              eyebrow="Phone-first operations"
              title="Built for phone-first property operations."
              description="Property managers and caretakers can open RentFlow from a phone and keep daily work moving, even when they are away from a desktop."
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Today</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">Bookings, units, and payment work stay visible.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Mobile</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">Caregivers can act from the home screen like an app.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">PWA</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">Optimized for quick checks, updates, and task reviews.</p>
              </div>
            </div>
          </div>
          <div className="lg:col-span-5">
            <PhonePreview />
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              eyebrow="Pricing"
              title="Pricing cards that read like a SaaS plan grid."
              description="The launch offer keeps pricing straightforward while the setup fee still applies during onboarding."
            />
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold tracking-[0.08em] text-slate-600">
              Launch offer: first month free. Setup fee applies.
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {PRICING_PLANS.map((plan) => (
              <PricingCard key={plan.name} {...plan} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <FaqSection
          title="RentFlow questions property teams ask first"
          description="A few clear answers help property owners understand what RentFlow does before they book a walkthrough."
          items={RENTFLOW_FAQS}
        />
      </section>

      <section className="border-t border-slate-200 bg-blue-50/40 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 rounded-[2rem] border border-blue-200 bg-white p-6 shadow-sm lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Ready to see it?</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Book a walkthrough or compare RentFlow with the rest of the SSAMENJ suite.
            </h2>
          </div>
          <div className="grid gap-3 lg:col-span-4">
            <a
              href={BOOK_DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="btn marketing-button-motion motion-cta rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-center text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25"
            >
              Book a walkthrough
            </a>
            <Link
              to="/products"
              className="btn marketing-button-motion motion-cta rounded-xl border border-blue-200 bg-white px-4 py-3 text-center text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
            >
              See all products
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
