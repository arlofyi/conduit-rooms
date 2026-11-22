/**
 * Theme switching, the way Conduit does it (src/themes.ts): a stored
 * preference, resolved against the system appearance, applied to <html>
 * before first paint. The colors themselves live in styles/theme.css.
 */

export const THEMES = [
  { id: "warm-near-black", label: "Warm Near-Black" },
  { id: "warm-dim", label: "Warm Dim" },
  { id: "warm-light", label: "Warm Light" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type ThemePreference = ThemeId | "auto";

export const DEFAULT_THEME: ThemeId = "warm-near-black";

const STORAGE_KEY = "conduit.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function isPreference(value: string | null): value is ThemePreference {
  return value === "auto" || THEMES.some((theme) => theme.id === value);
}

export function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isPreference(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function storePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Private mode or a full quota. The theme still applies for this session.
  }
}

export function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/** Calls back whenever the system switches between light and dark. Returns the unsubscribe. */
export function watchSystemAppearance(onChange: (dark: boolean) => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  const listener = (event: MediaQueryListEvent) => onChange(event.matches);

  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ThemeId {
  if (preference !== "auto") return preference;
  return systemDark ? "warm-near-black" : "warm-light";
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme;
}
