import type { ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";
import { hasPermission } from "../shared/permissions";

export function PermissionGuard({ permission, children }: { permission: string; children: ReactNode }) {
  const { user } = useAuth();
  if (!hasPermission(user?.role, permission)) {
    return (
      <main className="grid gap-4 p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-base font-bold text-red-800">Access denied</p>
          <p className="mt-1 text-sm text-red-700">You do not have permission to access this page.</p>
        </div>
      </main>
    );
  }
  return <>{children}</>;
}
