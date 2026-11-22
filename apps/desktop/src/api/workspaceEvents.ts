import { routes, type MessagesResponse, type WorkspaceEvent } from "@rooms/shared";
import { useEffect, useState } from "react";
import { useSWRConfig, type Cache, type ScopedMutator } from "swr";
import {
  addArtifact,
  appendStep,
  editDirectChat,
  editDirectChatLead,
  editRoomMember,
  removeMessage,
  upsertMessage,
} from "./cacheUpdates";
import { openEventStream } from "./eventStream";
import { clearJoinProgress, setJoinProgress } from "./liveJoining";
import { applyDelta, clearLiveText } from "./liveText";

/**
 * The live half of the data layer. One event stream stays open for the whole
 * app, and every event on it is folded into the same caches the query hooks
 * read. A component never listens for events itself: it reads a cache, and
 * the cache changes underneath it.
 */

export type Connection = "connecting" | "live" | "reconnecting";

/** Mount once, near the root. Returns the state of the connection to the sidecar. */
export function useWorkspaceEvents(): Connection {
  const { mutate, cache } = useSWRConfig();
  const [connection, setConnection] = useState<Connection>("connecting");

  useEffect(() => {
    return openEventStream(routes.events(), {
      onEvent: (data) => foldEvent(JSON.parse(data) as WorkspaceEvent, mutate, cache),
      onOpen: (again) => {
        setConnection("live");
        // Events sent while we were away are gone. Refetch what they would have changed.
        if (again) void mutate(isConversationData);
      },
      onDrop: () => setConnection("reconnecting"),
    });
  }, [mutate, cache]);

  return connection;
}

function isConversationData(key: unknown): boolean {
  return (
    typeof key === "string" &&
    (key.includes("/conversations/") || key === routes.rooms() || key === routes.directChats())
  );
}

/** Applies one event to the caches. Exported for tests. */
export function foldEvent(event: WorkspaceEvent, mutate: ScopedMutator, cache: Cache): void {
  switch (event.type) {
    case "message.created":
      upsertMessage(mutate, event.message);
      editDirectChat(mutate, event.conversationId, { lastActivityAt: event.message.createdAt });
      return;

    case "message.delta": {
      const known = cachedBody(cache, event.conversationId, event.messageId);
      const result = applyDelta(event.messageId, event.offset, event.text, known);

      // We joined this reply partway through. The sidecar has the text we missed.
      if (result === "gap") void mutate(routes.messages(event.conversationId));
      return;
    }

    case "message.settled":
      upsertMessage(mutate, event.message);
      clearLiveText(event.message.id);
      return;

    case "message.removed":
      removeMessage(mutate, event.conversationId, event.messageId);
      return;

    case "artifact.created":
      addArtifact(mutate, event.artifact);
      return;

    case "message.step":
      appendStep(mutate, event.conversationId, event.messageId, event.step);
      return;

    case "lead.joining":
      setJoinProgress(event.conversationId, event.projectId, event.progress);
      return;

    case "lead.status":
      // Any new status means the joining it was reporting on is over, or starting afresh.
      clearJoinProgress(event.conversationId, event.projectId);
      // The conversation is a project room or a common room. Only the matching cache changes.
      editDirectChatLead(mutate, event.conversationId, event.projectId, event.status);
      editRoomMember(mutate, event.conversationId, event.projectId, event.status);
      return;
  }
}

function cachedBody(cache: Cache, conversationId: string, messageId: string): string {
  const cached = cache.get(routes.messages(conversationId))?.data as MessagesResponse | undefined;
  return cached?.messages.find((message) => message.id === messageId)?.body ?? "";
}
