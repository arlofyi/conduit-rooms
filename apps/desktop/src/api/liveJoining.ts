import type { JoinProgress } from "@rooms/shared";
import { useSyncExternalStore } from "react";

/**
 * How far each lead has got with joining: writing its first brief.
 *
 * Like streamed text (liveText.ts), this changes many times in a minute and
 * matters to one row only, so it lives outside the SWR cache and only the row
 * showing that lead subscribes. Nothing here is stored: it is gone the moment
 * the lead has joined.
 */

const joining = new Map<string, JoinProgress>();
const listeners = new Set<() => void>();

const keyOf = (conversationId: string, projectId: string) => `${conversationId}:${projectId}`;

function notify(): void {
  for (const listener of listeners) listener();
}

export function setJoinProgress(conversationId: string, projectId: string, progress: JoinProgress): void {
  joining.set(keyOf(conversationId, projectId), progress);
  notify();
}

export function clearJoinProgress(conversationId: string, projectId: string): void {
  if (joining.delete(keyOf(conversationId, projectId))) notify();
}

/** How this lead's joining is going in this conversation, or null when it has reported nothing yet. */
export function useJoinProgress(conversationId: string, projectId: string): JoinProgress | null {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => joining.get(keyOf(conversationId, projectId)) ?? null,
  );
}
