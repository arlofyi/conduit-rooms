import { useMemo, useState, type KeyboardEvent } from "react";
import {
  filterMentionOptions,
  insertMention,
  mentionQueryAt,
  type MentionOption,
} from "./mentionQuery";

interface MentionPickerInput {
  text: string;
  caret: number;
  /** Who can be tagged here. Empty turns the picker off. */
  options: readonly MentionOption[];
  /** Called with the new text and caret when a mention is inserted. */
  onInsert: (text: string, caret: number) => void;
}

interface MentionPicker {
  /** The matches to show, or null when the picker is closed. */
  matches: MentionOption[] | null;
  highlighted: number;
  pick: (option: MentionOption) => void;
  /** Give this every key press first. True means the picker used the key. */
  handleKey: (event: KeyboardEvent) => boolean;
}

/**
 * The state behind the "@" picker (R-UI-38 to 40). The picker is open
 * whenever the caret sits at the end of an "@..." that matches someone,
 * unless you pressed Escape on that same "@".
 */
export function useMentionPicker({ text, caret, options, onInsert }: MentionPickerInput): MentionPicker {
  const [highlighted, setHighlighted] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  const query = useMemo(() => mentionQueryAt(text, caret), [text, caret]);
  const matches = useMemo(() => {
    if (!query || options.length === 0 || query.start === dismissedAt) return null;

    const found = filterMentionOptions(options, query.query);
    return found.length > 0 ? found : null;
  }, [query, options, dismissedAt]);

  // The list changed under the highlight. Keep it on a row that exists.
  const index = matches ? Math.min(highlighted, matches.length - 1) : 0;

  function pick(option: MentionOption) {
    if (!query) return;
    const next = insertMention(text, caret, query, option.handle);
    onInsert(next.text, next.caret);
    setHighlighted(0);
  }

  function handleKey(event: KeyboardEvent): boolean {
    if (!matches) return false;

    switch (event.key) {
      case "ArrowDown":
        setHighlighted((index + 1) % matches.length);
        return true;
      case "ArrowUp":
        setHighlighted((index - 1 + matches.length) % matches.length);
        return true;
      case "Enter":
      case "Tab":
        pick(matches[index]!);
        return true;
      case "Escape":
        // Closes the picker and leaves what you typed (R-UI-40).
        setDismissedAt(query?.start ?? null);
        return true;
      default:
        return false;
    }
  }

  return { matches, highlighted: index, pick, handleKey };
}
