import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function LogoutPage() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (user?.role === "SECURITY" || user?.role === "GATE_SECURITY") {
      navigate("/nfc/gate", { replace: true });
      return;
    }

    logout();
    navigate("/login", { replace: true });
  }, [loading]);

  return null;
}

