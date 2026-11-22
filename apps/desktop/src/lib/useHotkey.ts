import { useEffect, useEffectEvent } from "react";

/**
 * Runs `onPress` when Cmd (or Ctrl, off the Mac) and this key are pressed
 * together, anywhere in the window. The browser's own use of the shortcut is
 * suppressed.
 */
export function useHotkey(key: string, onPress: () => void): void {
  const press = useEffectEvent(onPress);

  useEffect(() => {
    const listen = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== key) return;
      event.preventDefault();
      press();
    };

    window.addEventListener("keydown", listen);
    return () => window.removeEventListener("keydown", listen);
  }, [key]);
}
