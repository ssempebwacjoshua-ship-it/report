import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getDefaultRouteForRole, hasPermission } from "../shared/permissions";

export function PermissionGuard({ permission, children }: { permission: string; children: ReactNode }) {
  const { user } = useAuth();
  if (!hasPermission(user?.role, permission)) {
    return <Navigate to={getDefaultRouteForRole(user?.role)} replace />;
  }
  return <>{children}</>;
}
