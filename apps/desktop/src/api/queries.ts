import {
  routes,
  type ActivityResponse,
  type AgentResponse,
  type ArtifactResponse,
  type ArtifactsResponse,
  type BriefResponse,
  type DirectChatsResponse,
  type DraftResponse,
  type MessagesResponse,
  type PersonaResponse,
  type ProjectsResponse,
  type RoomsResponse,
  type SessionTerminalResponse,
  type SessionTranscriptResponse,
  type UiStateResponse,
} from "@rooms/shared";
import useSWR, { type SWRConfiguration } from "swr";
import { getJson } from "./client";

/**
 * Everything the app reads from the sidecar. Each hook's cache key is the
 * route it reads, so "which request fills this?" is answered by the key.
 *
 * Conversations are kept fresh by live events (workspaceEvents.ts), so these
 * hooks do not refetch on focus. The project list does: it changes in
 * Conduit, which sends us no events.
 */

const LIVE: SWRConfiguration = { revalidateOnFocus: false, revalidateIfStale: false };


export function useProjects() {
  return useSWR<ProjectsResponse, Error>(routes.projects(), getJson);
}

/** How often to ask what Conduit's sessions are doing. Conduit polls its own panels at this rate. */
const ACTIVITY_POLL_MS = 4_000;

/**
 * What every project's sessions are doing in Conduit. This is the one thing
 * Rooms polls: the truth lives in Conduit's state file, and Conduit sends no events.
 */
export function useActivity() {
  return useSWR<ActivityResponse, Error>(routes.activity(), getJson, {
    refreshInterval: ACTIVITY_POLL_MS,
    // Keep showing the last known status through a failed poll.
    keepPreviousData: true,
  });
}

export function useDirectChats() {
  return useSWR<DirectChatsResponse, Error>(routes.directChats(), getJson);
}

/** Your common rooms and who is in each. Lead statuses are kept current by live events. */
export function useRooms() {
  return useSWR<RoomsResponse, Error>(routes.rooms(), getJson, LIVE);
}

export function useMessages(conversationId: string) {
  return useSWR<MessagesResponse, Error>(routes.messages(conversationId), getJson, LIVE);
}

/** Pass null to skip the request, for a sheet that is closed. */
export function useBrief(projectId: string | null) {
  return useSWR<BriefResponse, Error>(projectId && routes.brief(projectId), getJson);
}

/** A hired agent's instructions. Pass null to skip the request. */
export function useAgent(agentId: string | null) {
  return useSWR<AgentResponse, Error>(agentId && routes.agent(agentId), getJson, { revalidateOnFocus: false });
}

/** How often to look again while a lead is still writing its persona. */
const PERSONA_WRITING_POLL_MS = 2_000;

/**
 * A project agent's persona. Asking for one that does not exist starts the
 * lead writing it, so this polls until it arrives and then stops.
 * Pass null to skip the request, for a sheet that is closed.
 */
export function usePersona(projectId: string | null) {
  return useSWR<PersonaResponse, Error>(projectId && routes.persona(projectId), getJson, {
    revalidateOnFocus: false,
    refreshInterval: (latest) => (latest?.writing ? PERSONA_WRITING_POLL_MS : 0),
  });
}

/** The pages written in a conversation, without their contents. New ones arrive as live events. */
export function useArtifacts(conversationId: string) {
  return useSWR<ArtifactsResponse, Error>(routes.artifacts(conversationId), getJson, LIVE);
}

/** One page, with its contents. A page never changes once written. Pass null to skip the request. */
export function useArtifact(artifactId: string | null) {
  return useSWR<ArtifactResponse, Error>(artifactId && routes.artifact(artifactId), getJson, LIVE);
}

export function useStoredDraft(conversationId: string) {
  return useSWR<DraftResponse, Error>(routes.draft(conversationId), getJson, LIVE);
}

export function useUiState() {
  return useSWR<UiStateResponse, Error>(routes.uiState(), getJson, LIVE);
}

/**
 * Looking inside a Conduit session. Like activity, these are polled: the
 * transcript is a file Claude appends to and the terminal is a screen that
 * changes, and neither tells Rooms when it does. Polling stops when the view closes.
 */
const TRANSCRIPT_POLL_MS = 3_000;
const TERMINAL_POLL_MS = 1_500;
/** While you are typing into a terminal, the screen is read this often so it keeps up with you. */
const TERMINAL_TYPING_POLL_MS = 250;

export function useSessionTranscript(sessionId: string) {
  return useSWR<SessionTranscriptResponse, Error>(routes.sessionTranscript(sessionId), getJson, {
    refreshInterval: TRANSCRIPT_POLL_MS,
    keepPreviousData: false,
  });
}

export function useSessionTerminal(sessionId: string, typing: boolean) {
  return useSWR<SessionTerminalResponse, Error>(routes.sessionTerminal(sessionId), getJson, {
    refreshInterval: typing ? TERMINAL_TYPING_POLL_MS : TERMINAL_POLL_MS,
    // Two captures in a row are separate reads of a changing screen. Never reuse one for the other.
    dedupingInterval: 0,
  });
}
