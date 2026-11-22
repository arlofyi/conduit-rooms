/**
 * Mentions: "@handle" inside a message addresses that project's lead, and
 * "@all" addresses every lead in the room (specs/02-concepts.md).
 */

export const MENTION_ALL = "all";

// "@" must start the message or follow something that cannot be part of a
// word or an address, so "name@host" and "path/@scope" are not mentions.
const MENTION = /(?<![a-z0-9@/._-])@([a-z0-9][a-z0-9-]*)/gi;

/** The handles mentioned in a message, lowercased, in order, each once. */
export function findMentions(body: string): string[] {
  const handles = [...body.matchAll(MENTION)].map((match) => match[1]!.toLowerCase());
  return [...new Set(handles)];
}

/** Splits a message into plain text and mentions, for drawing mentions as pills. */
export function splitMentions(body: string): Array<{ text: string; handle: string | null }> {
  const parts: Array<{ text: string; handle: string | null }> = [];
  let last = 0;

  for (const match of body.matchAll(MENTION)) {
    if (match.index > last) parts.push({ text: body.slice(last, match.index), handle: null });
    parts.push({ text: match[0], handle: match[1]!.toLowerCase() });
    last = match.index + match[0].length;
  }

  if (last < body.length) parts.push({ text: body.slice(last), handle: null });
  return parts;
}
