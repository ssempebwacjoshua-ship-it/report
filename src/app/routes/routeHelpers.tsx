import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { SectionLoader } from "../../components/SectionLoader";
import { getDefaultRouteForRole } from "../../shared/permissions";

export function RoleAwareRedirect() {
  const { user } = useAuth();
  return <Navigate to={getDefaultRouteForRole(user?.role)} replace />;
}

export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <SectionLoader message="Loading SSAMENJ..." />;
  }

  if (user) {
    return <Navigate to={user.isPlatformOwner ? "/owner" : getDefaultRouteForRole(user.role)} replace />;
  }

  return <>{children}</>;
}
