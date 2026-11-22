import {
  routes,
  type ArtifactRef,
  type ArtifactsResponse,
  type DirectChat,
  type DirectChatsResponse,
  type LeadStatus,
  type Message,
  type MessagesResponse,
  type ReplyStep,
  type Room,
  type RoomsResponse,
} from "@rooms/shared";
import type { ScopedMutator } from "swr";

/**
 * Edits to cached data that do not need a round trip. Each one changes the
 * cache in place and skips revalidation, because the caller already holds
 * the truth: a live event, or the response to its own request.
 */

const IN_PLACE = { revalidate: false } as const;

function editMessages(
  mutate: ScopedMutator,
  conversationId: string,
  edit: (messages: Message[]) => Message[],
): void {
  void mutate<MessagesResponse>(
    routes.messages(conversationId),
    (current) => current && { ...current, messages: edit(current.messages) },
    IN_PLACE,
  );
}

/** Adds a message, or replaces the copy already there. Order is by id, which is by time. */
export function upsertMessage(mutate: ScopedMutator, message: Message): void {
  editMessages(mutate, message.conversationId, (messages) => {
    const index = messages.findIndex((existing) => existing.id === message.id);
    if (index === -1) return [...messages, message].sort((a, b) => (a.id < b.id ? -1 : 1));

    const next = [...messages];
    next[index] = message;
    return next;
  });
}

/** Adds a page to its conversation's list. */
export function addArtifact(mutate: ScopedMutator, artifact: ArtifactRef): void {
  void mutate<ArtifactsResponse>(
    routes.artifacts(artifact.conversationId),
    (current) =>
      current && !current.artifacts.some((known) => known.id === artifact.id)
        ? { artifacts: [...current.artifacts, artifact] }
        : current,
    IN_PLACE,
  );
}

/** Adds one step to a reply that is still being written. */
export function appendStep(mutate: ScopedMutator, conversationId: string, messageId: string, step: ReplyStep): void {
  editMessages(mutate, conversationId, (messages) =>
    messages.map((message) =>
      message.id === messageId ? { ...message, steps: [...(message.steps ?? []), step] } : message,
    ),
  );
}

export function removeMessage(mutate: ScopedMutator, conversationId: string, messageId: string): void {
  editMessages(mutate, conversationId, (messages) => messages.filter((message) => message.id !== messageId));
}

export function editDirectChat(
  mutate: ScopedMutator,
  conversationId: string,
  patch: Partial<DirectChat>,
): void {
  void mutate<DirectChatsResponse>(
    routes.directChats(),
    (current) =>
      current && {
        directChats: current.directChats.map((chat) =>
          chat.id === conversationId ? { ...chat, ...patch } : chat,
        ),
      },
    IN_PLACE,
  );
}

/**
 * Records what the lead of a project room is doing. In a product's room a
 * repo's lead can speak too, and its status is not the room's, so a status
 * for anyone but the room's own lead changes nothing.
 */
export function editDirectChatLead(
  mutate: ScopedMutator,
  conversationId: string,
  projectId: string,
  leadStatus: LeadStatus,
): void {
  void mutate<DirectChatsResponse>(
    routes.directChats(),
    (current) =>
      current && {
        directChats: current.directChats.map((chat) =>
          chat.id === conversationId && chat.projectId === projectId ? { ...chat, leadStatus } : chat,
        ),
      },
    IN_PLACE,
  );
}

/** Adds a room to the list, or replaces the copy already there. */
export function upsertRoom(mutate: ScopedMutator, room: Room): void {
  void mutate<RoomsResponse>(
    routes.rooms(),
    (current) => {
      if (!current) return current;

      const exists = current.rooms.some((existing) => existing.id === room.id);
      return {
        rooms: exists
          ? current.rooms.map((existing) => (existing.id === room.id ? room : existing))
          : [...current.rooms, room],
      };
    },
    IN_PLACE,
  );
}

/** Records what a lead is doing in a common room. A no-op for any other conversation. */
export function editRoomMember(
  mutate: ScopedMutator,
  roomId: string,
  projectId: string,
  leadStatus: LeadStatus,
): void {
  void mutate<RoomsResponse>(
    routes.rooms(),
    (current) =>
      current && {
        rooms: current.rooms.map((room) =>
          room.id !== roomId
            ? room
            : {
                ...room,
                members: room.members.map((member) =>
                  member.projectId === projectId ? { ...member, leadStatus } : member,
                ),
              },
        ),
      },
    IN_PLACE,
  );
}
