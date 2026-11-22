/**
 * The contract between the desktop app and the sidecar. Both sides import
 * this file, so a route, a payload and its type can never drift apart.
 *
 * Every route lives under /api. Requests and responses are JSON, except the
 * events route, which is a server-sent event stream of WorkspaceEvent.
 */

import type {
  Artifact,
  ArtifactRef,
  Brief,
  DirectChat,
  Draft,
  HiredAgent,
  JoinProgress,
  Persona,
  ProjectActivity,
  Room,
  SessionTerminal,
  SessionTranscript,
  LeadFailure,
  LeadStatus,
  Message,
  Project,
  UiState,
} from "./entities";
import type { ReplyStep } from "./steps";

export const API_PREFIX = "/api";

/** Path builders. The sidecar registers these same strings as its routes. */
export const routes = {
  health: () => `${API_PREFIX}/health`,
  projects: () => `${API_PREFIX}/projects`,
  activity: () => `${API_PREFIX}/activity`,
  directChat: (conversationId: string) => `${API_PREFIX}/direct-chats/${conversationId}`,
  brief: (projectId: string) => `${API_PREFIX}/projects/${projectId}/brief`,
  persona: (projectId: string) => `${API_PREFIX}/projects/${projectId}/persona`,
  agents: () => `${API_PREFIX}/agents`,
  agentDraft: () => `${API_PREFIX}/agents/draft`,
  agent: (agentId: string) => `${API_PREFIX}/agents/${agentId}`,
  artifacts: (conversationId: string) => `${API_PREFIX}/conversations/${conversationId}/artifacts`,
  artifact: (artifactId: string) => `${API_PREFIX}/artifacts/${artifactId}`,
  products: () => `${API_PREFIX}/products`,
  product: (productId: string) => `${API_PREFIX}/products/${productId}`,
  directChats: () => `${API_PREFIX}/direct-chats`,
  sessionTranscript: (sessionId: string) => `${API_PREFIX}/sessions/${sessionId}/transcript`,
  sessionTerminal: (sessionId: string) => `${API_PREFIX}/sessions/${sessionId}/terminal`,
  sessionMessage: (sessionId: string) => `${API_PREFIX}/sessions/${sessionId}/message`,
  sessionInput: (sessionId: string) => `${API_PREFIX}/sessions/${sessionId}/input`,
  rooms: () => `${API_PREFIX}/rooms`,
  room: (roomId: string) => `${API_PREFIX}/rooms/${roomId}`,
  messages: (conversationId: string) =>
    `${API_PREFIX}/conversations/${conversationId}/messages`,
  events: () => `${API_PREFIX}/events`,
  stop: (conversationId: string) =>
    `${API_PREFIX}/conversations/${conversationId}/stop`,
  rerun: (conversationId: string, messageId: string) =>
    `${API_PREFIX}/conversations/${conversationId}/messages/${messageId}/rerun`,
  draft: (conversationId: string) =>
    `${API_PREFIX}/conversations/${conversationId}/draft`,
  uiState: () => `${API_PREFIX}/ui-state`,
} as const;

// ---- Responses ----

export interface HealthResponse {
  ok: true;
  /**
   * How leads will authenticate. "claude_login" is assumed, not verified: the
   * sidecar cannot see whether this machine is signed in until a lead wakes.
   */
  leadAuth: "api_key" | "claude_login";
}

export interface ProjectsResponse {
  projects: Project[];
}

/** What every project's sessions are doing in Conduit, right now. Polled. */
export interface ActivityResponse {
  activity: ProjectActivity[];
}

export interface DirectChatsResponse {
  directChats: DirectChat[];
}

export interface DirectChatResponse {
  directChat: DirectChat;
}

/** Adds a project room to the sidebar, or takes it off. Its history is kept either way. */
export interface UpdateDirectChatRequest {
  added: boolean;
}

export interface SessionTranscriptResponse {
  transcript: SessionTranscript;
}

export interface SessionTerminalResponse {
  terminal: SessionTerminal;
}

/** A whole message for the session's agent, sent as if pasted and submitted. Text, pictures, or both. */
export interface SendSessionMessageRequest {
  text: string;
  images?: SessionImage[];
}

/** The kinds of picture a session can be sent, and the file ending each is saved with. */
export const SESSION_IMAGE_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
} as const;

export type SessionImageType = keyof typeof SESSION_IMAGE_TYPES;

export interface SessionImage {
  mediaType: SessionImageType;
  /** The file's bytes, base64 encoded. */
  data: string;
}

export const SESSION_IMAGES_MAX = 6;
/** Claude takes pictures up to about this size. */
export const SESSION_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Raw keystrokes for the session's terminal, exactly as a terminal would send them. */
export interface SendSessionInputRequest {
  data: string;
}

export interface RoomsResponse {
  /** Oldest first. */
  rooms: Room[];
}

export interface RoomResponse {
  room: Room;
}

export interface CreateRoomRequest {
  name: string;
  /** Project ids, in the order they should be listed. */
  memberIds: string[];
}

/** Send only what changes. `memberIds` replaces the whole member list. */
export type UpdateRoomRequest = Partial<CreateRoomRequest>;

export interface MessagesResponse {
  /** Oldest first. A reply in progress carries the text written so far. */
  messages: Message[];
}

export interface BriefResponse {
  /** Null when the project has never been messaged, so no brief exists yet. */
  brief: Brief | null;
}

// ---- Hired agents ----

/** Step one of hiring: a name and what you want the agent for. */
export interface DraftAgentRequest {
  name: string;
  briefing: string;
}

/** What comes back for you to edit before hiring. */
export interface DraftAgentResponse {
  instructions: string;
  persona: string;
}

export interface HireAgentRequest {
  name: string;
  instructions: string;
  persona: string;
}

export interface AgentResponse {
  agent: Project;
  hired: HiredAgent;
}

export interface UpdateAgentRequest {
  instructions: string;
}

// ---- Artifacts ----

export interface ArtifactsResponse {
  /** Every artifact written in a conversation, oldest first, without their pages. */
  artifacts: ArtifactRef[];
}

export interface ArtifactResponse {
  artifact: Artifact;
}

// ---- Products ----

export interface CreateProductRequest {
  name: string;
  /** What you will type after "@". Left out, it is made from the name. */
  handle?: string;
  /** The repos under this product. A repo that was under another product moves to this one. */
  repoIds: string[];
}

/** Send only what changes. `repoIds` replaces the whole list. The handle is fixed once chosen. */
export type UpdateProductRequest = Partial<Pick<CreateProductRequest, "name" | "repoIds">>;

export interface ProductResponse {
  product: Project;
}

export interface PersonaResponse {
  /** Null until one has been written. `writing` is true while the lead is drafting it. */
  persona: Persona | null;
  writing: boolean;
}

export interface SavePersonaRequest {
  body: string;
}

export interface DraftResponse {
  draft: Draft | null;
}

export interface UiStateResponse {
  uiState: UiState;
}

// ---- Requests ----

export const MESSAGE_MAX_LENGTH = 16_000;

export interface SendMessageRequest {
  body: string;
}

export interface SendMessageResponse {
  message: Message;
}

export interface SaveDraftRequest {
  body: string;
}

export type SaveUiStateRequest = Partial<UiState>;

// ---- Errors ----

export type ApiErrorCode =
  | "not_found"
  | "invalid_request"
  | "unauthorized"
  | "conflict"
  | "internal";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

// ---- Live events ----

/**
 * Everything that can change in a conversation while the app is open.
 * The frontend folds these into its cache. It never polls a conversation.
 */
export type ConversationEvent =
  | { type: "message.created"; message: Message }
  | {
      type: "message.delta";
      messageId: string;
      /** Where this text starts in the message body, so a late listener can tell what it missed. */
      offset: number;
      text: string;
    }
  | { type: "message.settled"; message: Message }
  | { type: "message.removed"; messageId: string }
  /** An agent finished writing a page for you to open. */
  | { type: "artifact.created"; artifact: ArtifactRef }
  /** A lead took one more step on the way to a reply that is still being written. */
  | { type: "message.step"; messageId: string; step: ReplyStep }
  /** How far a lead has got with writing its first brief. Each one replaces the last. Not kept. */
  | { type: "lead.joining"; projectId: string; progress: JoinProgress }
  | {
      type: "lead.status";
      projectId: string;
      status: LeadStatus;
      failure?: LeadFailure;
    };

/** One stream carries every conversation, so the sidebar can show activity in chats that are not open. */
export type WorkspaceEvent = ConversationEvent & { conversationId: string };
