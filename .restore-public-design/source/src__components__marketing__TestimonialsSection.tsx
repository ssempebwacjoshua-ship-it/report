function TestimonialCard({
  quote,
  attribution,
}: {
  quote: string;
  attribution: string;
}) {
  return (
    <figure className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-300" />
      <div className="absolute -right-10 top-6 h-24 w-24 rounded-full bg-blue-50/70 blur-3xl transition duration-200 group-hover:bg-blue-100/80" />
      <blockquote className="relative text-sm leading-6 text-slate-700">"{quote}"</blockquote>
      <figcaption className="relative mt-3 text-xs font-black uppercase tracking-[0.18em] text-blue-700">
        {attribution}
      </figcaption>
    </figure>
  );
}

export function TestimonialsSection({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const cards = [
    {
      quote: "Report Lab can remove the pressure of preparing student reports manually every term.",
      attribution: "School administrator",
    },
    {
      quote: "Smart Pages is useful because handwritten school documents can become clean PDFs without typing everything again.",
      attribution: "School office team",
    },
    {
      quote: "The system feels practical for schools because it starts with the work schools already do every day.",
      attribution: "School leadership team",
    },
  ];

  return (
    <section className={className}>
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">EARLY FEEDBACK</p>
          <h2 className={compact ? "mt-2 text-2xl font-black tracking-tight text-slate-950" : "mt-2 text-3xl font-black tracking-tight text-slate-950"}>
            What school teams are noticing.
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            School Connect is being shaped around real school workflows: faster reports, less typing, cleaner documents, and easier school operations.
          </p>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {cards.map((card) => (
            <TestimonialCard key={card.quote} quote={card.quote} attribution={card.attribution} />
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          
        </p>
      </div>
    </section>
  );
}



