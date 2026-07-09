import {
  CASHLESS_CANTEEN_FAQS,
  CONTACT_FAQS,
  DEMOS_FAQS,
  HOME_FAQS,
  PRICING_FAQS,
  REPORT_LAB_FAQS,
  RENTFLOW_FAQS,
  STAYOS_FAQS,
  SMART_PAGES_FAQS,
} from "../content/discoverability";

export const SITE_NAME = "SSAMENJ Technologies";
export const SITE_URL = "https://ssamenj.vercel.app";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/ssamenj-hero-ecosystem.png`;

export type JsonLdValue = Record<string, unknown> | Array<Record<string, unknown>>;

export type FaqItem = {
  question: string;
  answer: string;
};

export type SeoPage = {
  title: string;
  description: string;
  canonicalPath: string;
  structuredData?: JsonLdValue;
};

const SEO_BY_PATH: Record<string, SeoPage> = {
  "/": {
    title: "SSAMENJ Technologies | Uganda School Software, Report Lab & Smart Pages",
    description:
      "SSAMENJ Technologies builds Uganda school software for report cards, digital documents, School Connect workflows, and NFC tools for schools and offices.",
    canonicalPath: "/",
    structuredData: buildFaqSchema(HOME_FAQS),
  },
  "/products": {
    title: "SSAMENJ Products | Report Lab, Smart Pages, School Connect & NFC",
    description:
      "Explore SSAMENJ school software and office tools including Report Lab, Smart Pages, School Connect, NFC bands, Kids Wallet, and custom digital products.",
    canonicalPath: "/products",
    structuredData: buildBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Products", path: "/products" },
    ]),
  },
  "/rentflow": {
    title: "SSAMENJ RentFlow - Rental and Property Management Software Uganda",
    description:
      "SSAMENJ RentFlow helps Uganda property owners manage Airbnb rooms, residential rentals, commercial shops, payments, deposits, maintenance, cleaning, and owner statements.",
    canonicalPath: "/rentflow",
    structuredData: [
      buildSoftwareApplicationSchema({
        name: "SSAMENJ RentFlow",
        description:
          "Rental and property management software for Airbnb rooms, residential rentals, commercial shops, and apartments.",
        url: `${SITE_URL}/rentflow`,
        category: "BusinessApplication",
      }),
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Products", path: "/products" },
        { name: "RentFlow", path: "/rentflow" },
      ]),
      buildFaqSchema(RENTFLOW_FAQS),
    ],
  },
  "/report-lab": {
    title: "School Report Card System Uganda | Report Lab by SSAMENJ",
    description:
      "Report Lab helps Uganda schools upload marks, generate digital school reports, and share professional report cards with parents faster.",
    canonicalPath: "/report-lab",
    structuredData: [
      buildSoftwareApplicationSchema({
        name: "School Connect Report Lab",
        description:
          "A school report card system for Uganda schools that generate digital school reports from uploaded marks.",
        url: `${SITE_URL}/report-lab`,
        category: "EducationalApplication",
      }),
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Products", path: "/products" },
        { name: "Report Lab", path: "/report-lab" },
      ]),
      buildFaqSchema(REPORT_LAB_FAQS),
    ],
  },
  "/smart-pages": {
    title: "Smart Pages Uganda | Digital School Documents by SSAMENJ",
    description:
      "Smart Pages turns school documents into clean digital pages for circulars, notices, timetables, and shareable PDFs.",
    canonicalPath: "/smart-pages",
    structuredData: [
      buildSoftwareApplicationSchema({
        name: "Smart Pages",
        description:
          "Digital school document workflow software for turning school documents into clean pages and PDFs.",
        url: `${SITE_URL}/smart-pages`,
        category: "BusinessApplication",
      }),
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Products", path: "/products" },
        { name: "Smart Pages", path: "/smart-pages" },
      ]),
      buildFaqSchema(SMART_PAGES_FAQS),
    ],
  },
  "/nfc": {
    title: "School Connect NFC | Gate Security, Attendance & Wallets",
    description:
      "See how School Connect NFC helps schools manage gate access, attendance, canteen payments, and offline-ready student identity workflows.",
    canonicalPath: "/nfc",
    structuredData: [
      buildSoftwareApplicationSchema({
        name: "School Connect NFC",
        description:
          "NFC wristband, card, and tag workflows for school gate access, attendance, and canteen payments.",
        url: `${SITE_URL}/nfc`,
        category: "EducationalApplication",
      }),
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Products", path: "/products" },
        { name: "NFC", path: "/nfc" },
      ]),
    ],
  },
  "/demos": {
    title: "SSAMENJ Demos | Report Lab, Smart Pages & NFC",
    description:
      "Watch SSAMENJ demos for Report Lab, Smart Pages, and School Connect NFC to see the workflows in action.",
    canonicalPath: "/demos",
    structuredData: [
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Demos", path: "/demos" },
      ]),
      buildFaqSchema(DEMOS_FAQS),
    ],
  },
  "/pricing": {
    title: "SSAMENJ Pricing | Report Lab and Smart Pages",
    description:
      "Review SSAMENJ pricing for Report Lab, Smart Pages, School Connect, NFC setup, onboarding support, and first-term-free launch details.",
    canonicalPath: "/pricing",
    structuredData: [
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Pricing", path: "/pricing" },
      ]),
      buildFaqSchema(PRICING_FAQS),
    ],
  },
  "/about": {
    title: "About SSAMENJ Technologies",
    description:
      "Learn how SSAMENJ Technologies builds practical digital systems for schools, legal teams, and growing organizations.",
    canonicalPath: "/about",
  },
  "/contact": {
    title: "Contact SSAMENJ Technologies",
    description:
      "Contact SSAMENJ Technologies on WhatsApp to request a demo, ask about pricing, or discuss setup for your school or organization.",
    canonicalPath: "/contact",
    structuredData: [
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Contact", path: "/contact" },
      ]),
      buildFaqSchema(CONTACT_FAQS),
    ],
  },
  "/cashless-canteen": {
    title: "Cashless School Canteen Uganda | Kids Wallet by SSAMENJ",
    description:
      "Cashless School Canteen helps schools manage lunch payments, wallet top-ups, and controlled student spending using Kids Wallet and NFC.",
    canonicalPath: "/cashless-canteen",
    structuredData: [
      buildSoftwareApplicationSchema({
        name: "Cashless School Canteen",
        description:
          "A school canteen workflow for student wallet top-ups, controlled spending, and NFC-based payments.",
        url: `${SITE_URL}/cashless-canteen`,
        category: "BusinessApplication",
      }),
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Products", path: "/products" },
        { name: "Cashless Canteen", path: "/cashless-canteen" },
      ]),
      buildFaqSchema(CASHLESS_CANTEEN_FAQS),
    ],
  },
  "/stayos": {
    title: "StayOS | Property Operations Software by SSAMENJ",
    description:
      "StayOS is the public landing page for SSAMENJ's property operations workflow for rentals, short stays, and mixed portfolios, powered by RentFlow.",
    canonicalPath: "/stayos",
    structuredData: [
      buildSoftwareApplicationSchema({
        name: "StayOS by SSAMENJ",
        description:
          "Property operations landing page for stays, bookings, balances, cleaning, and owner reporting.",
        url: `${SITE_URL}/stayos`,
        category: "BusinessApplication",
      }),
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Products", path: "/products" },
        { name: "StayOS", path: "/stayos" },
      ]),
      buildFaqSchema(STAYOS_FAQS),
    ],
  },
  "/demo": {
    title: "SSAMENJ Demos | Report Lab, Smart Pages & NFC",
    description:
      "Watch SSAMENJ demos for Report Lab, Smart Pages, and School Connect NFC to see the workflows in action.",
    canonicalPath: "/demos",
  },
  "/features-demo": {
    title: "SSAMENJ Demos | Report Lab, Smart Pages & NFC",
    description:
      "Watch SSAMENJ demos for Report Lab, Smart Pages, and School Connect NFC to see the workflows in action.",
    canonicalPath: "/demos",
  },
};

export function normalizeSeoPath(pathname: string) {
  if (!pathname || pathname === "/") return "/";

  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (trimmed === "/demo" || trimmed === "/features-demo") return "/demos";
  if (trimmed === "/rentals") return "/rentflow";
  return trimmed || "/";
}

export function getSeoForPathname(pathname: string): SeoPage {
  const normalized = normalizeSeoPath(pathname);
  return SEO_BY_PATH[normalized] ?? SEO_BY_PATH["/"];
}

export function buildFaqSchema(faqs: FaqItem[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function buildBreadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: new URL(item.path, SITE_URL).toString(),
    })),
  };
}

export function buildSoftwareApplicationSchema(options: {
  name: string;
  description: string;
  url: string;
  category?: string;
}) {
  return {
    "@type": "SoftwareApplication",
    name: options.name,
    description: options.description,
    url: options.url,
    applicationCategory: options.category ?? "BusinessApplication",
    operatingSystem: "Web",
    provider: {
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}
