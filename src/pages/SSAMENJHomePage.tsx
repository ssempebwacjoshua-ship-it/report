import { Link } from "react-router-dom";

export function SSAMENJHomePage() {
  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="border-b border-blue-100 bg-gradient-to-br from-white via-blue-50 to-slate-50 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">SSAMENJ Technologies</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
            Smart school systems for reports, documents, and day-to-day operations.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            School Connect brings Report Lab, Smart Pages, and other school tools together on one public site and one private app.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn btn-primary rounded-xl px-4 py-3 text-sm font-black" to="/demos">View demos</Link>
            <Link className="btn btn-secondary rounded-xl px-4 py-3 text-sm font-bold" to="/contact">Contact us</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
