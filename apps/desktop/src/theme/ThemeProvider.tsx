import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyTheme,
  readStoredPreference,
  resolveTheme,
  storePreference,
  systemPrefersDark,
  watchSystemAppearance,
  type ThemeId,
  type ThemePreference,
} from "./themes";

interface ThemeContextValue {
  /** What you chose: a theme, or "auto" to follow the system. */
  preference: ThemePreference;
  /** The theme on screen right now. */
  theme: ThemeId;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setStoredPreference] = useState(readStoredPreference);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  const theme = resolveTheme(preference, systemDark);

  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => watchSystemAppearance(setSystemDark), []);

  const setPreference = useCallback((next: ThemePreference) => {
    storePreference(next);
    setStoredPreference(next);
  }, []);

  const value = useMemo(() => ({ preference, theme, setPreference }), [preference, theme, setPreference]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const value = use(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>.");
  return value;
}
