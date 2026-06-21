function UseCaseCard({
  role,
  title,
  body,
}: {
  role: string;
  title: string;
  body: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-300" />
      <div className="absolute -right-10 top-6 h-24 w-24 rounded-full bg-blue-50/70 blur-3xl transition duration-200 group-hover:bg-blue-100/80" />
      <p className="relative text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">{role}</p>
      <h3 className="relative mt-2 text-sm font-black text-slate-950">{title}</h3>
      <p className="relative mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </article>
  );
}

export function TestimonialsSection({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const useCases = [
    {
      role: "For school administrators",
      title: "Prepare reports faster",
      body: "Move from manual marksheets to finished student reports without formatting delays every term.",
    },
    {
      role: "For front office teams",
      title: "Clean school documents in minutes",
      body: "Turn circulars, meeting notes, forms, and letters into polished, ready-to-print PDFs without retyping.",
    },
    {
      role: "For school leaders",
      title: "Share professional documents with confidence",
      body: "Send parents and staff consistent, well-formatted documents that reflect the school's standards.",
    },
  ];

  return (
    <section className={className}>
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">PRACTICAL USE CASES</p>
          <h2 className={compact ? "mt-2 text-2xl font-black tracking-tight text-slate-950" : "mt-2 text-3xl font-black tracking-tight text-slate-950"}>
            How schools use School Connect.
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            School Connect is built around real school workflows — faster reports, less typing, cleaner documents, and easier operations for every team.
          </p>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {useCases.map((card) => (
            <UseCaseCard key={card.role} role={card.role} title={card.title} body={card.body} />
          ))}
        </div>
      </div>
    </section>
  );
}
