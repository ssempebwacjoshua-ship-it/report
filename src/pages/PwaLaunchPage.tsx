import { Navigate } from "react-router-dom";
import { BrandedLoader } from "../components/BrandedLoader";
import { useAuth } from "../contexts/AuthContext";
import { resolveDedicatedPwaLaunchPath } from "../pwa/standaloneMode";

export function PwaLaunchPage() {
  const { user, token, loading } = useAuth();

  if (loading && token) {
    return <BrandedLoader message="Opening installed workspace..." />;
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={resolveDedicatedPwaLaunchPath(user.role)} replace />;
}
