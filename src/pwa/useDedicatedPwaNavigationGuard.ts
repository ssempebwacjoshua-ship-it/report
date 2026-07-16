import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { buildAppUrl, getDedicatedWorkspaceHomeForRole, isStandaloneDisplayMode } from "./standaloneMode";

const BACK_TRAP_STATE_KEY = "scDedicatedPwaBackTrap";

export function useDedicatedPwaNavigationGuard(role: string | null | undefined) {
  const location = useLocation();
  const navigate = useNavigate();
  const trapSeededRef = useRef(false);
  const dedicatedHome = useMemo(() => getDedicatedWorkspaceHomeForRole(role), [role]);
  const isStandaloneDedicated = isStandaloneDisplayMode() && !!dedicatedHome;

  useEffect(() => {
    trapSeededRef.current = false;
  }, [dedicatedHome]);

  useEffect(() => {
    if (!isStandaloneDedicated || !dedicatedHome) return;

    if (location.pathname !== dedicatedHome || location.search || location.hash) {
      navigate(dedicatedHome, { replace: true });
      return;
    }

    const homeUrl = buildAppUrl(dedicatedHome);
    const currentState = (window.history.state ?? {}) as Record<string, unknown>;
    window.history.replaceState({ ...currentState, [BACK_TRAP_STATE_KEY]: dedicatedHome }, "", homeUrl);

    if (!trapSeededRef.current) {
      window.history.pushState({ ...currentState, [BACK_TRAP_STATE_KEY]: dedicatedHome }, "", homeUrl);
      trapSeededRef.current = true;
    }

    function handlePopState() {
      navigate(dedicatedHome, { replace: true });
      window.history.pushState({ ...(window.history.state ?? {}), [BACK_TRAP_STATE_KEY]: dedicatedHome }, "", homeUrl);
      trapSeededRef.current = true;
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [dedicatedHome, isStandaloneDedicated, location.hash, location.pathname, location.search, navigate]);
}
