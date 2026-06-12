import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchSettings } from "../../client/settingsClient";
import type { SettingsResponse } from "../../shared/types/settings";

type SettingsContextValue = {
  settings: SettingsResponse | null;
  refreshSettings: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);

  async function refreshSettings() {
    const loaded = await fetchSettings();
    setSettings(loaded);
    document.documentElement.dataset.appDensity = loaded.sections.appearance.appDensity;
    document.documentElement.dataset.appFontSize = loaded.sections.appearance.fontSize;
  }

  useEffect(() => {
    refreshSettings().catch(() => {});
    const handler = () => {
      refreshSettings().catch(() => {});
    };
    window.addEventListener("settings-updated", handler);
    return () => window.removeEventListener("settings-updated", handler);
  }, []);

  return <SettingsContext.Provider value={{ settings, refreshSettings }}>{children}</SettingsContext.Provider>;
}

export function useAppSettings() {
  const value = useContext(SettingsContext);
  return value;
}
