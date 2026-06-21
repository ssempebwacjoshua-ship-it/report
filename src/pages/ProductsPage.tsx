import { Link } from "react-router-dom";

const products = [
  ["Report Lab", "Academic reports and secure parent-ready results."],
  ["Smart Pages", "Clean document extraction and publishing workflows."],
  ["School Connect", "Core school operations for growing institutions."],
];

export function ProductsPage() {
  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-4xl font-black tracking-tight text-slate-950">Products</h1>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {products.map(([title, body]) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-black">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <Link to="/pricing" className="btn btn-primary rounded-xl px-4 py-3 text-sm font-black">See pricing</Link>
            <Link to="/contact" className="btn btn-secondary rounded-xl px-4 py-3 text-sm font-bold">Talk to us</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
