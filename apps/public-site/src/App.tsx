import { useEffect, type ReactNode } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";

type Product = {
  id: string;
  title: string;
  description: string;
  status: string;
  ctaLabel: string;
  ctaHref: string;
  tags: string[];
};

type DemoItem = {
  title: string;
  description: string;
  status: string;
  href: string;
};

const products: Product[] = [
  {
    id: "report-lab",
    title: "Report Lab",
    description: "Build and manage school reports, releases, and follow-up workflows with less friction.",
    status: "Live",
    ctaLabel: "Open demos",
    ctaHref: "/demos",
    tags: ["Reports", "School workflows", "Release tools"],
  },
  {
    id: "smart-pages",
    title: "Smart Pages",
    description: "Create secure document experiences for schools, legal teams, and structured content.",
    status: "Live",
    ctaLabel: "See pricing",
    ctaHref: "/pricing",
    tags: ["Documents", "Secure sharing", "Extraction"],
  },
  {
    id: "school-connect",
    title: "School Connect",
    description: "Connect student, teacher, and school operations in one simple working system.",
    status: "Live",
    ctaLabel: "Learn more",
    ctaHref: "/about",
    tags: ["Students", "Teachers", "School ops"],
  },
  {
    id: "legal-smart-pages",
    title: "Legal Smart Pages",
    description: "Document handling and publishing support for legal teams and creator workflows.",
    status: "Available",
    ctaLabel: "Contact us",
    ctaHref: "/contact",
    tags: ["Legal", "Publishing", "Templates"],
  },
  {
    id: "kids-wallet",
    title: "Kids Wallet",
    description: "A simple child-focused wallet experience that can grow into approved spending workflows.",
    status: "Coming soon",
    ctaLabel: "Talk to sales",
    ctaHref: "/contact",
    tags: ["Wallets", "Guardrails", "Future release"],
  },
  {
    id: "nfc-bands",
    title: "NFC Bands",
    description: "Secure NFC credential workflows for schools, gate security, and student verification.",
    status: "Foundation",
    ctaLabel: "Explore demos",
    ctaHref: "/demos",
    tags: ["NFC", "Credentials", "School access"],
  },
  {
    id: "pearlmart",
    title: "PearlMart",
    description: "A commerce-ready product family for school and community sales experiences.",
    status: "Coming soon",
    ctaLabel: "Contact us",
    ctaHref: "/contact",
    tags: ["Commerce", "Marketplace", "Community"],
  },
  {
    id: "wideh-cash",
    title: "Wideh Cash",
    description: "Flexible digital money movement tools for approved internal and school-linked use cases.",
    status: "Roadmap",
    ctaLabel: "See pricing",
    ctaHref: "/pricing",
    tags: ["Payments", "Internal tools", "Digital value"],
  },
  {
    id: "custom-digital-products",
    title: "Custom Digital Products",
    description: "Tailored systems, workflows, and digital tools built around a school or institution's needs.",
    status: "On request",
    ctaLabel: "Start a conversation",
    ctaHref: "/contact",
    tags: ["Custom builds", "Workflow design", "Integration"],
  },
];

const demoItems: DemoItem[] = [
  {
    title: "Report Lab demo",
    description: "See a cleaner report workflow, release tooling, and school-facing report operations.",
    status: "Ready",
    href: "/demos#report-lab",
  },
  {
    title: "Smart Pages demo",
    description: "Review secure document creation, extraction, and publishing flows.",
    status: "Ready",
    href: "/demos#smart-pages",
  },
  {
    title: "School Connect overview",
    description: "A quick look at the school-facing system that powers the broader product family.",
    status: "Ready",
    href: "/demos#school-connect",
  },
  {
    title: "NFC Bands preview",
    description: "The credential foundation for secure wristband-based school operations.",
    status: "Coming soon",
    href: "/contact",
  },
  {
    title: "Kids Wallet preview",
    description: "Future wallet and spending guardrails for approved school and family use.",
    status: "Coming soon",
    href: "/contact",
  },
];

function ScrollManager() {
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash.replace("#", "");

    if (hash) {
      window.requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }

    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname, location.hash]);

  return null;
}

function LogoMark() {
  return (
    <div className="logo-mark" aria-label="SSAMENJ Technologies">
      <span className="logo-badge">S</span>
      <div>
        <div className="logo-name">SSAMENJ</div>
        <div className="logo-subtitle">Technologies</div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <header className="site-header">
        <Link to="/" className="brand-link" aria-label="SSAMENJ Technologies home">
          <LogoMark />
        </Link>

        <nav className="site-nav" aria-label="Primary">
          <NavLink to="/products" className={({ isActive }) => (isActive ? "active" : undefined)}>
            Products
          </NavLink>
          <NavLink to="/demos" className={({ isActive }) => (isActive ? "active" : undefined)}>
            Demos
          </NavLink>
          <NavLink to="/pricing" className={({ isActive }) => (isActive ? "active" : undefined)}>
            Pricing
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => (isActive ? "active" : undefined)}>
            About
          </NavLink>
          <NavLink to="/contact" className={({ isActive }) => (isActive ? "active" : undefined)}>
            Contact
          </NavLink>
        </nav>

        <a className="cta-button cta-button-soft" href="https://wa.me/971563704103" target="_blank" rel="noreferrer">
          WhatsApp
        </a>
      </header>

      <main>{children}</main>

      <footer className="site-footer">
        <div className="footer-brand">
          <LogoMark />
          <p>Smart systems for schools, legal teams, and custom digital products.</p>
        </div>

        <div>
          <h3>Products</h3>
          <ul className="footer-list">
            {products.map((product) => (
              <li key={product.id}>
                <a href={`/products#${product.id}`}>{product.title}</a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>Contact</h3>
          <ul className="footer-list">
            <li><a href="https://wa.me/971563704103" target="_blank" rel="noreferrer">Global WhatsApp</a></li>
            <li><a href="https://wa.me/256774549869" target="_blank" rel="noreferrer">Uganda Product Manager</a></li>
            <li><Link to="/pricing">Pricing</Link></li>
          </ul>
        </div>
      </footer>
    </div>
  );
}

function SmartLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  if (href.startsWith("http")) {
    return (
      <a className={className} href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }

  return (
    <Link className={className} to={href}>
      {children}
    </Link>
  );
}

function PageHero({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
}) {
  return (
    <section className="hero">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="hero-copy">{description}</p>
      <div className="hero-actions">
        <SmartLink href={primaryHref} className="cta-button">
          {primaryLabel}
        </SmartLink>
        <SmartLink href={secondaryHref} className="cta-button cta-button-soft">
          {secondaryLabel}
        </SmartLink>
      </div>
    </section>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <article id={product.id} className="product-card">
      <div className="card-topline">
        <span className="status-badge">{product.status}</span>
        <span className="product-id">#{product.id}</span>
      </div>
      <h3>{product.title}</h3>
      <p>{product.description}</p>
      <div className="tag-row">
        {product.tags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
          </span>
        ))}
      </div>
      <a className="text-link" href={product.ctaHref}>
        {product.ctaLabel}
      </a>
    </article>
  );
}

function HomePage() {
  return (
    <Shell>
      <PageHero
        eyebrow="SSAMENJ Technologies"
        title="Smart Systems. Simple Work."
        description="We build practical software for schools and growing organizations: reports, secure documents, student systems, and clear digital products."
        primaryHref="/demos"
        primaryLabel="View demos"
        secondaryHref="/contact"
        secondaryLabel="Contact sales"
      />

      <section className="content-band">
        <SectionHeading
          title="A focused product family"
          description="Each product solves a real operational problem and stays easy to adopt."
        />
        <div className="mini-grid">
          <article className="mini-card">
            <h3>Report Lab</h3>
            <p>School reporting and release workflows with less friction.</p>
          </article>
          <article className="mini-card">
            <h3>Smart Pages</h3>
            <p>Secure document extraction, publishing, and structured sharing.</p>
          </article>
          <article className="mini-card">
            <h3>School Connect</h3>
            <p>The school-facing foundation for connected operations.</p>
          </article>
        </div>
      </section>
    </Shell>
  );
}

function ProductsPage() {
  return (
    <Shell>
      <section className="page-section">
        <PageHero
          eyebrow="Products"
          title="Built to keep the work moving."
          description="From school operations to digital products, every card below is designed to stay simple, clear, and useful."
          primaryHref="/contact"
          primaryLabel="Talk to us"
          secondaryHref="/demos"
          secondaryLabel="See demos"
        />

        <SectionHeading
          title="Product lineup"
          description="All product cards include stable ids so hash links work cleanly."
        />

        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </Shell>
  );
}

function DemosPage() {
  return (
    <Shell>
      <section className="page-section">
        <PageHero
          eyebrow="Demos"
          title="See the product family in motion."
          description="We keep the public demos short and practical so schools and teams can understand the fit quickly."
          primaryHref="/pricing"
          primaryLabel="Review pricing"
          secondaryHref="/products"
          secondaryLabel="Browse products"
        />

        <div className="demo-grid">
          {demoItems.map((demo) => (
            <article key={demo.title} className="demo-card">
              <span className="status-badge">{demo.status}</span>
              <h3>{demo.title}</h3>
              <p>{demo.description}</p>
              <a className="text-link" href={demo.href}>
                Open
              </a>
            </article>
          ))}
        </div>
      </section>
    </Shell>
  );
}

function PricingPage() {
  return (
    <Shell>
      <section className="page-section">
        <PageHero
          eyebrow="Pricing"
          title="First term free for early onboarding schools."
          description="Start with one free academic term, then choose the plan that matches your school size and workflow."
          primaryHref="/contact"
          primaryLabel="Start onboarding"
          secondaryHref="/demos"
          secondaryLabel="See demos"
        />

        <SectionHeading
          title="School pricing"
          description="Simple term pricing for schools, plus a separate Smart Pages credit model."
        />

        <div className="pricing-grid">
          <article className="pricing-card pricing-card-featured">
            <span className="status-badge">Launch offer</span>
            <h3>First Term Free</h3>
            <p>For early onboarding schools, multi-term commitment, or annual upfront payment.</p>
            <ul>
              <li>Standard setup can be waived</li>
              <li>One academic term at no subscription cost</li>
              <li>Works with Report Lab and Smart Pages</li>
            </ul>
          </article>

          <article className="pricing-card">
            <span className="status-badge">Starter School</span>
            <h3>UGX 350,000 / term</h3>
            <p>For schools up to 300 students.</p>
          </article>

          <article className="pricing-card">
            <span className="status-badge">Standard School</span>
            <h3>UGX 750,000 / term</h3>
            <p>For schools with 301 to 800 students.</p>
          </article>

          <article className="pricing-card">
            <span className="status-badge">Pro School</span>
            <h3>UGX 1,500,000 / term</h3>
            <p>For large schools with 800+ students.</p>
          </article>

          <article className="pricing-card">
            <span className="status-badge">Enterprise</span>
            <h3>Custom pricing</h3>
            <p>For multi-campus schools, groups, and institutions needing custom workflows.</p>
          </article>
        </div>

        <SectionHeading
          title="Smart Pages credit packs"
          description="Credits are separate from school term pricing."
        />

        <div className="pricing-grid">
          <article className="pricing-card">
            <span className="status-badge">Trial</span>
            <h3>20 credits free</h3>
            <p>A quick start for evaluation and early testing.</p>
          </article>
          <article className="pricing-card">
            <span className="status-badge">Starter</span>
            <h3>100 credits - UGX 50,000</h3>
          </article>
          <article className="pricing-card">
            <span className="status-badge">Standard</span>
            <h3>500 credits - UGX 225,000</h3>
          </article>
          <article className="pricing-card">
            <span className="status-badge">School Pro</span>
            <h3>1,000 credits - UGX 400,000</h3>
          </article>
        </div>

        <div className="pricing-note">
          <h3>Usage guide</h3>
          <ul>
            <li>Normal document extraction: 1 credit per page</li>
            <li>High accuracy extraction: 2 credits per page</li>
            <li>Generate clean document: +1 credit per output page</li>
            <li>Publish or share secure document: +1 credit per document</li>
            <li>Standard setup: UGX 250,000</li>
          </ul>
        </div>
      </section>
    </Shell>
  );
}

function AboutPage() {
  return (
    <Shell>
      <section className="page-section">
        <PageHero
          eyebrow="About"
          title="We build a small number of useful products very well."
          description="SSAMENJ Technologies focuses on practical systems for schools, legal teams, and custom digital products that need to stay dependable."
          primaryHref="/products"
          primaryLabel="See products"
          secondaryHref="/contact"
          secondaryLabel="Get in touch"
        />

        <div className="about-grid">
          <article className="about-card">
            <h3>School systems</h3>
            <p>Report Lab, School Connect, NFC Bands, and Kids Wallet are designed around real school operations.</p>
          </article>
          <article className="about-card">
            <h3>Document systems</h3>
            <p>Smart Pages and Legal Smart Pages focus on secure extraction, publishing, and document workflows.</p>
          </article>
          <article className="about-card">
            <h3>Custom builds</h3>
            <p>When a workflow is specific, we build around the problem instead of forcing a generic tool.</p>
          </article>
        </div>
      </section>
    </Shell>
  );
}

function ContactPage() {
  return (
    <Shell>
      <section className="page-section">
        <PageHero
          eyebrow="Contact"
          title="Start with a conversation."
          description="Reach the right person quickly for school setup, product questions, and onboarding."
          primaryHref="https://wa.me/971563704103"
          primaryLabel="Global WhatsApp"
          secondaryHref="https://wa.me/256774549869"
          secondaryLabel="Uganda Product Manager"
        />

        <div className="contact-grid">
          <article className="contact-card">
            <span className="status-badge">Global WhatsApp</span>
            <h3>+971 56 370 4103</h3>
            <a className="text-link" href="https://wa.me/971563704103" target="_blank" rel="noreferrer">
              wa.me/971563704103
            </a>
          </article>
          <article className="contact-card">
            <span className="status-badge">Uganda Product Manager</span>
            <h3>+256 774 549 869</h3>
            <a className="text-link" href="https://wa.me/256774549869" target="_blank" rel="noreferrer">
              wa.me/256774549869
            </a>
          </article>
        </div>
      </section>
    </Shell>
  );
}

export default function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/demos" element={<DemosPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/demo" element={<Navigate to="/demos" replace />} />
        <Route path="/dem" element={<Navigate to="/demos" replace />} />
        <Route path="/features-demo" element={<Navigate to="/demos" replace />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
