import { useCallback, useEffect, useRef, useState } from "react";
import { useSaveDraft } from "@/api/mutations";
import { useStoredDraft } from "@/api/queries";

const SAVE_AFTER_MS = 400;

interface DraftControls {
  text: string;
  setText: (text: string) => void;
  /** Empties the draft at once, for when the message has been sent. */
  clear: () => void;
}

/**
 * The text you are in the middle of typing in one conversation (R-UI-37).
 *
 * What you type shows instantly from local state. It is saved to the sidecar
 * shortly after you pause, and straight away if you leave the conversation,
 * so the draft is there when you come back and after a relaunch.
 */
export function useDraft(conversationId: string): DraftControls {
  const stored = useStoredDraft(conversationId);
  const saveDraft = useSaveDraft(conversationId);

  // Null until you type. Until then the stored draft, once loaded, is what shows.
  const [typed, setTyped] = useState<string | null>(null);
  const unsaved = useRef<string | null>(null);

  const text = typed ?? stored.data?.draft?.body ?? "";

  const flush = useCallback(() => {
    if (unsaved.current === null) return;
    void saveDraft(unsaved.current);
    unsaved.current = null;
  }, [saveDraft]);

  useEffect(() => {
    if (unsaved.current === null) return;
    const timer = setTimeout(flush, SAVE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [typed, flush]);

  // Leaving the conversation: save whatever the timer had not got to yet.
  useEffect(() => flush, [flush]);

  const setText = useCallback((next: string) => {
    unsaved.current = next;
    setTyped(next);
  }, []);

  const clear = useCallback(() => {
    // The sidecar drops the stored draft itself when a message is sent.
    unsaved.current = null;
    setTyped("");
  }, []);

  return { text, setText, clear };
}
