import type { Message, Project } from "@rooms/shared";
import type { RoomRef } from "../chat/channelService";
import { getDirectChat, touchDirectChat, type StoredDirectChat } from "../store/directChats";
import { listProductRepos } from "../store/products";
import { getProject } from "../store/projects";
import { getRoom, listRoomMembers } from "../store/rooms";
import type { AppContext } from "./context";
import { notFound } from "./errors";

/**
 * What the HTTP routes can do with a conversation, whichever kind it is.
 * A project room and a common room answer the same five calls, so the
 * routes in routes/conversations.ts never need to know which they have.
 */
export interface Conversation {
  id: string;
  send(body: string): Message;
  stop(): void;
  /** Has a message answered again: your message by whoever it is for, a lead's reply by that lead. */
  rerun(messageId: string): void;
  messages(): Message[];
}

/** Finds the conversation a route was called for, or answers 404. */
export function requireConversation(ctx: AppContext, conversationId: string): Conversation {
  return commonRoom(ctx, conversationId) ?? projectRoom(ctx, conversationId) ?? missing();
}

function missing(): never {
  throw notFound("That conversation");
}

function projectRoom(ctx: AppContext, conversationId: string): Conversation | null {
  const chat = getDirectChat(ctx.db, conversationId);
  const project = chat && getProject(ctx.db, chat.projectId);
  if (!chat || !project) return null;
  if (project.kind === "product") return productRoom(ctx, chat, project);

  return {
    id: chat.id,
    send: (body) => ctx.directChats.send(chat, project, body),
    stop: () => ctx.directChats.stop(chat),
    rerun: (messageId) => ctx.directChats.rerun(chat, project, messageId),
    messages: () => ctx.directChats.messages(chat),
  };
}

/**
 * A product's room. The product's lead answers, and the lead of any repo
 * under it answers when tagged, so it runs on the same service as a common
 * room, with the product's lead as host.
 */
function productRoom(ctx: AppContext, chat: StoredDirectChat, product: Project): Conversation {
  const room: RoomRef = { id: chat.id, name: product.handle };

  // Read on every call, so a repo put under the product a moment ago can already be tagged.
  const members = () => [product, ...listProductRepos(ctx.db, product.id)];

  return {
    id: chat.id,
    send: (body) => {
      const message = ctx.channels.send(room, members(), body, product);
      touchDirectChat(ctx.db, chat.id, message.createdAt);
      return message;
    },
    stop: () => ctx.channels.stop(room),
    rerun: (messageId) => ctx.channels.rerun(room, members(), messageId, product),
    messages: () => ctx.channels.messages(room),
  };
}

function commonRoom(ctx: AppContext, conversationId: string): Conversation | null {
  const room = getRoom(ctx.db, conversationId);
  if (!room) return null;

  // Read on every call, so a member added a moment ago can already be tagged.
  const members = () => listRoomMembers(ctx.db, room.id);

  return {
    id: room.id,
    send: (body) => ctx.channels.send(room, members(), body),
    stop: () => ctx.channels.stop(room),
    rerun: (messageId) => ctx.channels.rerun(room, members(), messageId),
    messages: () => ctx.channels.messages(room),
  };
}
