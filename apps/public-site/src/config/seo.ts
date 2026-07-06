export const SITE_NAME = "SSAMENJ Technologies";
export const SITE_URL = "https://ssamenj.vercel.app";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/ssamenj-hero-ecosystem.png`;

export type SeoPage = {
  title: string;
  description: string;
  canonicalPath: string;
};

const SEO_BY_PATH: Record<string, SeoPage> = {
  "/": {
    title: "SSAMENJ Technologies | School Software, Report Lab & Smart Pages",
    description:
      "SSAMENJ Technologies builds Report Lab, Smart Pages, School Connect, and NFC tools for schools and offices in Uganda and beyond.",
    canonicalPath: "/",
  },
  "/products": {
    title: "SSAMENJ Products | Report Lab, Smart Pages, School Connect & NFC",
    description:
      "Explore SSAMENJ school and office software including Report Lab, Smart Pages, School Connect, NFC bands, Kids Wallet, and custom digital products.",
    canonicalPath: "/products",
  },
  "/report-lab": {
    title: "Report Lab for Schools | SSAMENJ Technologies",
    description:
      "Learn about SSAMENJ Report Lab, the school reporting system that helps teachers generate clean, professional student reports.",
    canonicalPath: "/products",
  },
  "/smart-pages": {
    title: "Smart Pages for Schools and Offices | SSAMENJ Technologies",
    description:
      "Learn about SSAMENJ Smart Pages, the digital document workflow for schools and offices that need clean, shareable pages.",
    canonicalPath: "/products",
  },
  "/nfc": {
    title: "School Connect NFC | Gate Security, Attendance & Wallets",
    description:
      "See how School Connect NFC helps schools manage gate access, attendance, canteen payments, and offline-ready student identity workflows.",
    canonicalPath: "/nfc",
  },
  "/demos": {
    title: "SSAMENJ Demos | Report Lab, Smart Pages & NFC",
    description:
      "Watch SSAMENJ demos for Report Lab, Smart Pages, and School Connect NFC to see the workflows in action.",
    canonicalPath: "/demos",
  },
  "/pricing": {
    title: "SSAMENJ Pricing | Report Lab and Smart Pages",
    description:
      "Review SSAMENJ pricing for Report Lab, Smart Pages, School Connect, NFC setup, and onboarding support.",
    canonicalPath: "/pricing",
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
  return trimmed || "/";
}

export function getSeoForPathname(pathname: string): SeoPage {
  const normalized = normalizeSeoPath(pathname);
  return SEO_BY_PATH[normalized] ?? SEO_BY_PATH["/"];
}
