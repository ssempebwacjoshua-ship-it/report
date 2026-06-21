import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { buildWhatsAppUrl } from "../config/contact";
import {
  BookIcon,
  CheckIcon,
  FileTextIcon,
  GridIcon,
  SchoolIcon,
  ShieldIcon,
  SmartphoneIcon,
  SparklesIcon,
} from "../components/marketing/Icons";
import { TestimonialsSection } from "../components/marketing/TestimonialsSection";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I'd like to book a product demo for my organisation.",
);

type Status = "live" | "demo" | "development" | "soon";

interface Product {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: ReactNode;
  iconBig: ReactNode;
  status: Status;
  audience: string[];
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  accentColor: string;
  accentBg: string;
}

const PRODUCTS: Product[] = [
  {
    id: "report-lab",
    name: "School Connect Report Lab",
    tagline: "Professional student reports from marksheets.",
    description:
      "Report Lab transforms raw marksheet data into polished, professional student report cards. Teachers enter marks, administrators review, approve and release, and parents receive secure links.",
    icon: <FileTextIcon className="h-6 w-6" />,
    iconBig: <FileTextIcon className="h-8 w-8" />,
    status: "live",
    audience: ["Schools", "Teachers", "Parents", "Administrators"],
    features: [
      "Mark entry from subject teachers",
      "Automatic grade and position calculation",
      "Class teacher and head teacher comments",
      "One-click report generation for whole class",
      "Secure parent-facing report links",
      "Batch release to parents",
    ],
    ctaLabel: "Open Demo",
    ctaHref: "/demos",
    secondaryLabel: "Book walkthrough",
    secondaryHref: BOOK_DEMO_URL,
    accentColor: "#0F5BD8",
    accentBg: "#EAF3FF",
  },
  {
    id: "smart-pages",
    name: "Smart Pages",
    tagline: "Turn documents into clean, digital, organized pages.",
    description:
      "Smart Pages lets schools and offices upload raw documents and convert them into structured, searchable, shareable digital pages.",
    icon: <GridIcon className="h-6 w-6" />,
    iconBig: <GridIcon className="h-8 w-8" />,
    status: "live",
    audience: ["Schools", "Offices", "Legal Teams", "Businesses"],
    features: [
      "Upload PDF or Word documents",
      "AI-assisted cleaning and structure",
      "Editable digital page output",
      "Shareable via secure link",
      "Collections for organized document sets",
      "Role-based access and permissions",
    ],
    ctaLabel: "View Demo",
    ctaHref: "/demos",
    secondaryLabel: "Book walkthrough",
    secondaryHref: BOOK_DEMO_URL,
    accentColor: "#0F5BD8",
    accentBg: "#EAF3FF",
  },
  {
    id: "school-connect",
    name: "School Connect Operations",
    tagline: "One connected platform for your entire school.",
    description:
      "School Connect Operations is a comprehensive school management platform with student records, attendance tracking, digital ID cards, notices, wallets, and administrative workflows.",
    icon: <SchoolIcon className="h-6 w-6" />,
    iconBig: <SchoolIcon className="h-8 w-8" />,
    status: "development",
    audience: ["Schools", "Administrators", "Teachers", "Support Staff"],
    features: [
      "Student enrolment and records",
      "Daily attendance tracking",
      "Digital student ID cards",
      "School notice board and parent communication",
      "Student wallet for school payments",
      "Academic year and term management",
    ],
    ctaLabel: "Get Notified",
    ctaHref: BOOK_DEMO_URL,
    accentColor: "#B45309",
    accentBg: "#FEF3C7",
  },
  {
    id: "legal-smart-pages",
    name: "Legal Smart Pages",
    tagline: "Smart document workflows for legal teams.",
    description:
      "Legal Smart Pages brings the Smart Pages engine to law firms and legal departments. Clean drafts, organize case documents, prepare filing-ready documents, and collaborate securely.",
    icon: <ShieldIcon className="h-6 w-6" />,
    iconBig: <ShieldIcon className="h-8 w-8" />,
    status: "demo",
    audience: ["Lawyers", "Law Firms", "Legal Departments", "Paralegals"],
    features: [
      "Legal document cleaning and formatting",
      "Case and matter-based document collections",
      "Client-safe document sharing",
      "Draft and final version tracking",
      "Team collaboration on live documents",
      "Secure access controls per case",
    ],
    ctaLabel: "Explore Demo",
    ctaHref: "/demos",
    secondaryLabel: "Book walkthrough",
    secondaryHref: BOOK_DEMO_URL,
    accentColor: "#7C3AED",
    accentBg: "#F5F3FF",
  },
  {
    id: "kids-wallet",
    name: "Kids Wallet",
    tagline: "Controlled school spending, safe and simple.",
    description:
      "Kids Wallet gives parents full control over what their child spends at school and can be linked to the canteen, school fees, and activities via digital ID or NFC wristband.",
    icon: <SmartphoneIcon className="h-6 w-6" />,
    iconBig: <SmartphoneIcon className="h-8 w-8" />,
    status: "soon",
    audience: ["Schools", "Parents", "Canteen Staff", "Finance Teams"],
    features: [
      "Parent-funded digital wallet per student",
      "Canteen and activity spending controls",
      "Spend limits and category restrictions",
      "Real-time parent notifications",
      "Linked to digital ID or NFC wristband",
      "School cashless payment system",
    ],
    ctaLabel: "Get Notified",
    ctaHref: BOOK_DEMO_URL,
    accentColor: "#0F5BD8",
    accentBg: "#EAF3FF",
  },
  {
    id: "nfc-bands",
    name: "NFC Wristbands",
    tagline: "Smart student access, attendance, and identity.",
    description:
      "NFC Wristbands give every student a neutral smart token that works at gates, canteen counters, attendance checkpoints, and wallet terminals. One tap identifies the student and triggers the appropriate action.",
    icon: <SparklesIcon className="h-6 w-6" />,
    iconBig: <SparklesIcon className="h-8 w-8" />,
    status: "soon",
    audience: ["Schools", "Security Staff", "Canteen Staff", "Administration"],
    features: [
      "Neutral NFC token on each wristband",
      "Gate access control and audit log",
      "Attendance tap-in and tap-out",
      "Canteen payment via wristband tap",
      "Lost or deactivated wristband blocking",
      "Role-based scan routing by staff device",
    ],
    ctaLabel: "Get Notified",
    ctaHref: BOOK_DEMO_URL,
    accentColor: "#0F5BD8",
    accentBg: "#EAF3FF",
  },
  {
    id: "pearlmart",
    name: "PearlMart",
    tagline: "Marketplace & digital commerce for the wider product family.",
    description:
      "PearlMart is a commerce-ready product family for product discovery, ordering workflows, and digital storefronts.",
    icon: <BookIcon className="h-6 w-6" />,
    iconBig: <BookIcon className="h-8 w-8" />,
    status: "demo",
    audience: ["Commerce", "Storefronts", "Product teams", "Operations"],
    features: [
      "Product showcase layouts",
      "Order and inquiry workflows",
      "Digital storefront support",
      "Category and inventory presentation",
    ],
    ctaLabel: "Talk to us",
    ctaHref: "/contact",
    accentColor: "#0F5BD8",
    accentBg: "#EAF3FF",
  },
  {
    id: "wideh-cash",
    name: "Wideh Cash",
    tagline: "Flexible digital money movement workflows.",
    description:
      "Wideh Cash supports approved money movement use cases for internal and school-linked workflows.",
    icon: <SparklesIcon className="h-6 w-6" />,
    iconBig: <SparklesIcon className="h-8 w-8" />,
    status: "demo",
    audience: ["Payments", "Internal tools", "School operations"],
    features: [
      "Controlled digital value flows",
      "Use-case specific rules",
      "Future wallet integrations",
      "Approval and audit visibility",
    ],
    ctaLabel: "Talk to us",
    ctaHref: "/contact",
    accentColor: "#0F5BD8",
    accentBg: "#EAF3FF",
  },
  {
    id: "custom-digital-products",
    name: "Custom Digital Products",
    tagline: "Built around your specific workflow.",
    description:
      "When off-the-shelf software does not fit, SSAMENJ designs and builds custom digital systems tailored to your organisation's actual processes.",
    icon: <SparklesIcon className="h-6 w-6" />,
    iconBig: <SparklesIcon className="h-8 w-8" />,
    status: "live",
    audience: ["Businesses", "NGOs", "Government", "Institutions"],
    features: [
      "Discovery and workflow mapping",
      "Purpose-built system architecture",
      "Mobile-friendly user interfaces",
      "Secure data management",
      "Ongoing support and maintenance",
      "Integration with existing tools",
    ],
    ctaLabel: "Get in Touch",
    ctaHref: "/contact",
    accentColor: "#0F5BD8",
    accentBg: "#EAF3FF",
  },
];

const STATUS_META: Record<Status, { label: string; bg: string; color: string; dot: string }> = {
  live: { label: "Live", bg: "#DCFCE7", color: "#16A34A", dot: "#22C55E" },
  demo: { label: "Demo Available", bg: "#DBEAFE", color: "#1D4ED8", dot: "#3B82F6" },
  development: { label: "In Development", bg: "#FEF3C7", color: "#B45309", dot: "#F59E0B" },
  soon: { label: "Coming Soon", bg: "#F1F5F9", color: "#64748B", dot: "#CBD5E1" },
};

function StatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: meta.bg, color: meta.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border bg-white" style={{ borderColor: "#D8E2F0", boxShadow: "0 2px 10px rgba(11,47,107,0.05)" }}>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: product.accentBg, color: product.accentColor }}>
            {product.iconBig}
          </div>
          <StatusBadge status={product.status} />
        </div>

        <div>
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: product.accentColor }}>
            {product.tagline}
          </p>
          <h2 className="text-base font-extrabold leading-snug" style={{ color: "#111827" }}>
            {product.name}
          </h2>
        </div>

        <p className="text-xs leading-relaxed" style={{ color: "#4B5563" }}>
          {product.description}
        </p>

        <ul className="space-y-1.5">
          {product.features.slice(0, 4).map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <span className="mt-px flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full" style={{ background: product.accentBg, color: product.accentColor }}>
                <CheckIcon className="h-2.5 w-2.5" />
              </span>
              <span className="text-xs leading-snug" style={{ color: "#374151" }}>
                {feature}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-1">
          {product.audience.map((audience) => (
            <span key={audience} className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "#EAF3FF", color: "#0F5BD8" }}>
              {audience}
            </span>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <a href={product.ctaHref} className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-colors hover:opacity-95" style={{ background: "#0F5BD8" }}>
            {product.ctaLabel}
          </a>
          {product.secondaryHref ? (
            <a href={product.secondaryHref} target={product.secondaryHref.startsWith("http") ? "_blank" : undefined} rel={product.secondaryHref.startsWith("http") ? "noreferrer" : undefined} className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
              {product.secondaryLabel}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function ProductsPage() {
  return (
    <div className="bg-slate-50 text-slate-950">
      <section className="border-b border-blue-100 bg-gradient-to-br from-white via-blue-50 to-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-7">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Products</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              A practical product family for schools, legal teams, and custom digital work.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              From school reports and document workflows to NFC wristbands and custom builds, the SSAMENJ product family stays focused on useful work.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link to="/demos" className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25">
                View demos
              </Link>
              <a href={BOOK_DEMO_URL} target="_blank" rel="noreferrer" className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
                Book a walkthrough
              </a>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-[1.75rem] border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">At a glance</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {PRODUCTS.slice(0, 4).map((product) => (
                  <div key={product.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: product.accentBg, color: product.accentColor }}>
                        {product.icon}
                      </div>
                      <StatusBadge status={product.status} />
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-950">{product.name}</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-600">{product.tagline}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {PRODUCTS.map((product) => (
              <div key={product.id} id={product.id} className="h-full">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <TestimonialsSection className="bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-7" compact />
    </div>
  );
}
