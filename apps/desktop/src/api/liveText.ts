import { useSyncExternalStore } from "react";

/**
 * The text of replies that are still being written.
 *
 * A reply can grow dozens of times a second. If each piece went through the
 * messages cache, every row in the conversation would re-render each time.
 * So streamed text lives here instead, keyed by message id, and only the one
 * row showing that message subscribes to it. When the reply settles, its
 * final body lands in the messages cache and the entry here is dropped.
 */

const texts = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();

function notify(messageId: string): void {
  for (const listener of listeners.get(messageId) ?? []) listener();
}

export type DeltaResult = "applied" | "already_have" | "gap";

/**
 * Adds a piece of streamed text. `offset` is where the piece starts in the
 * full body, which tells us whether it is the next piece, one we already
 * have, or one that arrived after a hole we need to refetch to fill.
 */
export function applyDelta(messageId: string, offset: number, text: string, knownBody = ""): DeltaResult {
  const current = longer(texts.get(messageId) ?? "", knownBody);

  if (offset > current.length) return "gap";
  if (offset < current.length) return "already_have";

  texts.set(messageId, current + text);
  notify(messageId);
  return "applied";
}

export function clearLiveText(messageId: string): void {
  if (texts.delete(messageId)) notify(messageId);
}

function longer(a: string, b: string): string {
  return a.length >= b.length ? a : b;
}

/**
 * The text to show for a message: whichever is further along, the streamed
 * text or the body from the cache. Both are prefixes of the same reply.
 */
export function useLiveText(messageId: string, cachedBody: string): string {
  const live = useSyncExternalStore(
    (onChange) => {
      const watching = listeners.get(messageId) ?? new Set();
      listeners.set(messageId, watching.add(onChange));

      return () => {
        watching.delete(onChange);
        if (watching.size === 0) listeners.delete(messageId);
      };
    },
    () => texts.get(messageId) ?? "",
  );

  return longer(live, cachedBody);
}
