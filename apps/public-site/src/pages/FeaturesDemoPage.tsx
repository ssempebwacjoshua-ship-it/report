import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightIcon } from "../components/marketing/Icons";

type DemoItem = {
  id: string;
  name: string;
  description: string;
  videoId?: string;
};

const REPORT_LAB_VIDEO_ID = "jZrp-jOhjwo";
const SMART_PAGES_VIDEO_ID = "F2kWYFQujK4";

const FEATURE_ITEMS: DemoItem[] = [
  {
    id: "report-lab",
    name: "Report Lab Demo",
    description: "Generate student reports from marksheets and share secure parent links.",
    videoId: REPORT_LAB_VIDEO_ID,
  },
  {
    id: "smart-pages",
    name: "Smart Pages Demo",
    description: "Turn school documents into clean, editable, printable pages.",
    videoId: SMART_PAGES_VIDEO_ID,
  },
];

function DemoCard({
  item,
  active,
  onSelect,
}: {
  item: DemoItem;
  active: boolean;
  onSelect: (item: DemoItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        active
          ? "border-blue-500 bg-blue-50 text-blue-800 shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black leading-snug text-slate-950">{item.name}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
        </div>
        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
          Video
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-blue-700">{active ? "Now playing" : "Play video"}</span>
        <ArrowRightIcon className="h-4 w-4 text-blue-700" />
      </div>
    </button>
  );
}

export function FeaturesDemoPage() {
  const [selectedId, setSelectedId] = useState(FEATURE_ITEMS[0]?.id ?? "report-lab");

  const selectedItem = useMemo(
    () => FEATURE_ITEMS.find((item) => item.id === selectedId) ?? FEATURE_ITEMS[0],
    [selectedId],
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Public demo hub</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Features Demo</h1>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
              Watch focused demos of School Connect Report Lab and Smart Pages.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/demos#report-lab"
              className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
            >
              Open Report Lab
            </Link>
            <Link
              to="/demos#smart-pages"
              className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
            >
              Open Smart Pages
            </Link>
            <Link
              to="/demos"
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-700"
            >
              Back to Main Demo
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)] lg:px-8 lg:py-8">
        <section className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${selectedItem?.videoId ?? REPORT_LAB_VIDEO_ID}`}
              title={`School Connect Features Demo - ${selectedItem?.name ?? "Video"}`}
              className="aspect-video w-full rounded-2xl border border-slate-200 shadow-sm"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
            />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Now showing</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">{selectedItem?.name ?? "Report Lab Demo"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{selectedItem?.description}</p>
          </div>
        </section>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Demo playlist</p>
            <div className="mt-3 grid gap-3">
              {FEATURE_ITEMS.map((item) => (
                <DemoCard
                  key={item.id}
                  item={item}
                  active={selectedItem?.id === item.id}
                  onSelect={(next) => {
                    if (!next.videoId) return;
                    setSelectedId(next.id);
                  }}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Quick links</p>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                to="/demos"
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back to /demos
              </Link>
              <Link
                to="/demos#report-lab"
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Open /demos#report-lab
              </Link>
              <Link
                to="/demos#smart-pages"
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Open /demos#smart-pages
              </Link>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
