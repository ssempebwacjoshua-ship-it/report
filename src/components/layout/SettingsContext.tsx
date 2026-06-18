import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { fetchSettings } from "../../client/settingsClient";
import { useAuth } from "../../contexts/AuthContext";
import type { SettingsResponse } from "../../shared/types/settings";

type SettingsContextValue = {
  settings: SettingsResponse | null;
  loading: boolean;
  error: string | null;
  refreshSettings: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const applyLoadedSettings = useCallback((loaded: SettingsResponse) => {
    setSettings(loaded);
    setError(null);
    document.documentElement.dataset.appDensity = loaded.sections.appearance.appDensity;
    document.documentElement.dataset.appFontSize = loaded.sections.appearance.fontSize;
  }, []);

  const loadSettings = useCallback(
    async ({ retry = true }: { retry?: boolean } = {}) => {
      const currentRequestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);

      async function attemptLoad() {
        const loaded = await fetchSettings();
        if (currentRequestId !== requestIdRef.current) return;
        applyLoadedSettings(loaded);
      }

      const failWithMessage = (loadError: unknown) => {
        if (currentRequestId !== requestIdRef.current) return;
        const message = loadError instanceof Error && loadError.message ? loadError.message : "Could not load school workspace.";
        setError(message);
      };

      try {
        await attemptLoad();
      } catch (errorFirstAttempt) {
        if (!retry) {
          failWithMessage(errorFirstAttempt);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 250));

        try {
          await attemptLoad();
        } catch (errorSecondAttempt) {
          failWithMessage(errorSecondAttempt);
        }
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [applyLoadedSettings],
  );

  const refreshSettings = useCallback(async () => {
    await loadSettings({ retry: true });
  }, [loadSettings]);

  useEffect(() => {
    if (!user || !token) {
      requestIdRef.current += 1;
      setSettings(null);
      setLoading(false);
      setError(null);
      return;
    }

    void loadSettings({ retry: true });
  }, [loadSettings, token, user?.id]);

  useEffect(() => {
    const handler = () => {
      void loadSettings({ retry: true });
    };
    window.addEventListener("settings-updated", handler);
    return () => window.removeEventListener("settings-updated", handler);
  }, [loadSettings]);

  return <SettingsContext.Provider value={{ settings, loading, error, refreshSettings }}>{children}</SettingsContext.Provider>;
}

export function useAppSettings() {
  const value = useContext(SettingsContext);
  return value;
}

