import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { TestimonialsSection } from "../components/marketing/TestimonialsSection";
import { BookIcon, GridIcon, SchoolIcon, ShieldIcon, SmartphoneIcon, SparklesIcon } from "../components/marketing/Icons";

function AboutCard({ title, body, icon }: { title: string; body: string; icon: ReactNode }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        {icon}
      </div>
      <h3 className="mt-3 text-xl font-black tracking-tight text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </article>
  );
}

export function AboutPage() {
  return (
    <div className="bg-slate-50 text-slate-950">
      <section className="border-b border-blue-100 bg-gradient-to-br from-white via-blue-50 to-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">About</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              We build a small number of useful products very well.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              SSAMENJ Technologies focuses on practical systems for schools, legal teams, and custom digital products that need to stay dependable.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link to="/products" className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25">
                See products
              </Link>
              <Link to="/contact" className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
                Get in touch
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-blue-200 bg-white p-3.5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">School systems</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">Report Lab, School Connect, NFC Bands, and Kids Wallet are designed around real school operations.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Document systems</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">Smart Pages and Legal Smart Pages focus on secure extraction, publishing, and document workflows.</p>
              </div>
              <div className="marketing-soft-float rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Custom builds</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">When a workflow is specific, we build around the problem instead of forcing a generic tool.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-3 lg:grid-cols-3">
            <AboutCard title="School systems" body="Product work that matches the school day, not an abstract software demo." icon={<SchoolIcon className="h-5 w-5" />} />
            <AboutCard title="Document systems" body="Secure document handling for structured content, legal teams, and admin workflows." icon={<GridIcon className="h-5 w-5" />} />
            <AboutCard title="Custom digital products" body="Built around what the organization actually needs, with room to grow." icon={<SparklesIcon className="h-5 w-5" />} />
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto grid max-w-7xl gap-3 lg:grid-cols-2">
          <AboutCard title="Our approach" body="We keep products simple to adopt, clear to explain, and practical to use." icon={<BookIcon className="h-5 w-5" />} />
          <AboutCard title="Security-aware by default" body="Public pages stay public, private systems stay private, and access is checked where it matters." icon={<ShieldIcon className="h-5 w-5" />} />
          <AboutCard title="A growing family" body="School Connect, Smart Pages, and the rest of the family all point toward one coherent product story." icon={<SmartphoneIcon className="h-5 w-5" />} />
          <AboutCard title="Built for real teams" body="The goal is never novelty for its own sake. It is smoother work for the people doing the work." icon={<GridIcon className="h-5 w-5" />} />
        </div>
      </section>

      <TestimonialsSection className="bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-7" compact />
    </div>
  );
}
