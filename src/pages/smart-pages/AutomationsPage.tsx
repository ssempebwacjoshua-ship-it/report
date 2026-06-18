import { useEffect, useState } from "react";
import { createWorkflow, listWorkflows, type AutomationWorkflow } from "../../client/documentOsClient";

const TRIGGERS = ["COLLECTION_IMPORTED", "RECORD_ADDED", "DOCUMENT_CREATED", "BULK_GENERATION_COMPLETED", "PUBLISH_COMPLETED"];
const ACTIONS = ["GENERATE_DOCUMENT", "PUBLISH_DOCUMENT", "EXPORT_PDF", "NOTIFY_CREATOR", "SEND_EMAIL"];

export function AutomationsPage() {
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState(TRIGGERS[0]);
  const [action, setAction] = useState(ACTIONS[0]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    listWorkflows().then(setWorkflows).catch((error: Error) => setNotice(error.message));
  }, []);

  async function create() {
    const workflow = await createWorkflow({ name: name.trim(), trigger, actions: [{ type: action }] });
    setWorkflows((current) => [workflow, ...current]);
    setName("");
    setNotice("Workflow created.");
  }

  return (
    <main className="grid gap-4">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Automation Service</p>
        <h1 className="text-xl font-bold text-slate-950">Automations</h1>
        <p className="mt-1 text-sm text-slate-500">Define reusable workflows triggered by imports, documents, and bulk jobs.</p>
      </header>
      {notice ? <div className="premium-card rounded-xl p-3 text-sm text-slate-700">{notice}</div> : null}
      <section className="premium-card grid gap-3 rounded-xl p-4 sm:grid-cols-[minmax(0,1fr)_220px_180px_auto]">
        <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Workflow name" />
        <select className="input" value={trigger} onChange={(event) => setTrigger(event.target.value)}>{TRIGGERS.map((item) => <option key={item}>{item}</option>)}</select>
        <select className="input" value={action} onChange={(event) => setAction(event.target.value)}>{ACTIONS.map((item) => <option key={item}>{item}</option>)}</select>
        <button type="button" className="btn btn-primary" onClick={() => void create()} disabled={!name.trim()}>Create</button>
      </section>
      <section className="grid gap-2">
        {workflows.map((workflow) => (
          <div key={workflow.id} className="premium-card rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-slate-950">{workflow.name}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${workflow.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{workflow.isActive ? "Active" : "Paused"}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{workflow.trigger} {"->"} {workflow.actions.map((item) => item.type).join(", ")}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

