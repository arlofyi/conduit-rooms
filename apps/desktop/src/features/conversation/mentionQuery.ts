/**
 * The "@..." you are in the middle of typing, if the caret is at the end of one.
 * The picker opens when "@" starts the input or follows whitespace (R-UI-38).
 */
export interface MentionQuery {
  /** What follows the "@" so far. Empty right after typing "@". */
  query: string;
  /** Where the "@" is in the text. */
  start: number;
}

const TRAILING_MENTION = /(?:^|\s)@([a-z0-9-]*)$/i;

export function mentionQueryAt(text: string, caret: number): MentionQuery | null {
  const match = TRAILING_MENTION.exec(text.slice(0, caret));
  if (!match) return null;

  const query = match[1]!;
  return { query: query.toLowerCase(), start: caret - query.length - 1 };
}

/** Replaces the mention being typed with the chosen handle and a space. Returns the new text and caret. */
export function insertMention(text: string, caret: number, at: MentionQuery, handle: string) {
  const inserted = `@${handle} `;
  return {
    text: text.slice(0, at.start) + inserted + text.slice(caret),
    caret: at.start + inserted.length,
  };
}

export interface MentionOption {
  handle: string;
  /** Shown beside the handle: the project's display name, or what "@all" means. */
  label: string;
}

/** Handles that start with the query first, then labels that contain it (R-UI-40). */
export function filterMentionOptions(options: readonly MentionOption[], query: string): MentionOption[] {
  if (!query) return [...options];

  const byHandle = options.filter((option) => option.handle.startsWith(query));
  const byLabel = options.filter(
    (option) => !option.handle.startsWith(query) && option.label.toLowerCase().includes(query),
  );
  return [...byHandle, ...byLabel];
}
