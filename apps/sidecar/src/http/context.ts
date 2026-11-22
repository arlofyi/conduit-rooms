import type { Project } from "@rooms/shared";
import type { ChannelService } from "../chat/channelService";
import type { ConversationBus } from "../chat/conversationBus";
import type { DirectChatService } from "../chat/directChatService";
import type { Config } from "../config";
import type { Ledger } from "../ledger/ledger";
import type { Personas } from "../leads/personas";
import type { LeadRuntime } from "../leads/runtime";
import type { Db } from "../store/db";
import { getDirectChat, type StoredDirectChat } from "../store/directChats";
import { getProject } from "../store/projects";
import { notFound } from "./errors";

/** Everything a route can reach. Built once in main.ts and passed to every route file. */
export interface AppContext {
  config: Config;
  db: Db;
  ledger: Ledger;
  runtime: LeadRuntime;
  bus: ConversationBus;
  directChats: DirectChatService;
  channels: ChannelService;
  personas: Personas;
  /** The secret the desktop app must send with every request. */
  token: string;
}

export function requireDirectChat(ctx: AppContext, conversationId: string): StoredDirectChat {
  const chat = getDirectChat(ctx.db, conversationId);
  if (!chat) throw notFound("That project room");
  return chat;
}

export function requireProject(ctx: AppContext, projectId: string): Project {
  const project = getProject(ctx.db, projectId);
  if (!project) throw notFound("That project");
  return project;
}
