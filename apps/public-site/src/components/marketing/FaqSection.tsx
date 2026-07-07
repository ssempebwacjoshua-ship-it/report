import type { FaqItem } from "../../config/seo";

export function FaqSection({
  eyebrow = "FAQ",
  title,
  description,
  items,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description: string;
  items: FaqItem[];
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.question}
              className="motion-card motion-card-stagger rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-200"
            >
              <h3 className="text-sm font-black text-slate-950">{item.question}</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">{item.answer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
