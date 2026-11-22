import type { ConversationEvent, WorkspaceEvent } from "@rooms/shared";

/**
 * Carries live events from whatever changes a conversation to whoever is
 * watching. The chat service publishes. The SSE route subscribes.
 * Nothing is buffered: a view that connects late loads history over HTTP.
 */
export interface ConversationBus {
  publish(conversationId: string, event: ConversationEvent): void;
  /** Returns the function that ends the subscription. */
  subscribe(listener: Listener): () => void;
}

type Listener = (event: WorkspaceEvent) => void;

export function createConversationBus(): ConversationBus {
  const listeners = new Set<Listener>();

  return {
    publish(conversationId, event) {
      for (const listener of listeners) listener({ ...event, conversationId });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
