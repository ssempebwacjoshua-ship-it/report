import type { DashboardAttendanceSummary } from "../../shared/types/dashboard";

type AttendanceListener = (summary: DashboardAttendanceSummary) => void;

const listenersBySchool = new Map<string, Set<AttendanceListener>>();

export function subscribeAttendanceRealtime(schoolId: string, listener: AttendanceListener): () => void {
  const listeners = listenersBySchool.get(schoolId) ?? new Set<AttendanceListener>();
  listeners.add(listener);
  listenersBySchool.set(schoolId, listeners);
  return () => {
    const current = listenersBySchool.get(schoolId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listenersBySchool.delete(schoolId);
  };
}

export function publishAttendanceRealtime(schoolId: string, summary: DashboardAttendanceSummary): void {
  const listeners = listenersBySchool.get(schoolId);
  if (!listeners) return;
  for (const listener of listeners) listener(summary);
}
