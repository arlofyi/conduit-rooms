import { useCallback, useState } from "react";

/**
 * One choice out of a fixed set, remembered in localStorage: which view you
 * last used, which tab was open. A stored value that is no longer one of the
 * allowed ones is ignored. Per-device convenience only, like useStoredFlag.
 */
export function useStoredChoice<T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[],
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key) as T | null;
      return stored && allowed.includes(stored) ? stored : fallback;
    } catch {
      return fallback;
    }
  });

  const store = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // Storage is unavailable. The choice still holds for this session.
      }
    },
    [key],
  );

  return [value, store];
}
