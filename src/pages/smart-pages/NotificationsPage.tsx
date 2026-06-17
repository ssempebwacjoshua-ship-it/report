import { useEffect, useState } from "react";
import { listNotifications, markNotificationRead, type NotificationItem } from "../../client/documentOsClient";

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  async function load() {
    setNotifications(await listNotifications(true));
  }

  useEffect(() => { void load(); }, []);

  async function markRead(id: string) {
    await markNotificationRead(id);
    await load();
  }

  return (
    <main className="grid gap-4">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Activity Center</p>
        <h1 className="text-xl font-bold text-slate-950">Notifications</h1>
        <p className="mt-1 text-sm text-slate-500">Bulk jobs, publishing, translations, and workflow events appear here.</p>
      </header>
      <section className="grid gap-2">
        {notifications.map((item) => (
          <div key={item.id} className="premium-card rounded-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase text-blue-600">{item.type}</p>
                <p className="mt-1 font-bold text-slate-950">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">{item.message}</p>
              </div>
              {!item.readAt ? <button type="button" className="btn btn-secondary" onClick={() => void markRead(item.id)}>Mark read</button> : null}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
