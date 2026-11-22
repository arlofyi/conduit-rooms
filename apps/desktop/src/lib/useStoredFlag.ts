import { useCallback, useState } from "react";

/**
 * A boolean remembered in localStorage: a collapsed section, a dismissed hint.
 * For small per-device conveniences only. Anything that must survive, or that
 * the sidecar needs to know, belongs in the sidecar's store instead.
 */
export function useStoredFlag(key: string, fallback: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => read(key) ?? fallback);

  const store = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        localStorage.setItem(key, String(next));
      } catch {
        // Storage is unavailable. The flag still holds for this session.
      }
    },
    [key],
  );

  return [value, store];
}

function read(key: string): boolean | null {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? null : stored === "true";
  } catch {
    return null;
  }
}
