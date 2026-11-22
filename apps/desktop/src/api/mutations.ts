import {
  routes,
  type AgentResponse,
  type CreateProductRequest,
  type CreateRoomRequest,
  type DraftAgentRequest,
  type DraftAgentResponse,
  type HireAgentRequest,
  type DirectChatResponse,
  type DraftResponse,
  type PersonaResponse,
  type ProductResponse,
  type Project,
  type Room,
  type RoomResponse,
  type SendMessageResponse,
  type SendSessionMessageRequest,
  type UiState,
  type UiStateResponse,
} from "@rooms/shared";
import { useCallback } from "react";
import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import { editDirectChat, upsertMessage, upsertRoom } from "./cacheUpdates";
import { sendJson } from "./client";

/** Everything the app asks the sidecar to change. */

/**
 * Sends a message. The reply does not come back from this call: it arrives
 * on the event stream, piece by piece.
 */
export function useSendMessage(conversationId: string) {
  const { mutate } = useSWRConfig();

  return useSWRMutation<SendMessageResponse, Error, string, string>(
    routes.messages(conversationId),
    (path, { arg: body }) => sendJson<SendMessageResponse>("POST", path, { body }),
    {
      // The messages cache is edited in place below. Refetching it would race the stream.
      revalidate: false,
      populateCache: false,
      onSuccess: ({ message }) => upsertMessage(mutate, message),
    },
  );
}

export function useStopReply(conversationId: string) {
  return useSWRMutation<void, Error, string>(routes.stop(conversationId), (path) =>
    sendJson<void>("POST", path),
  );
}

/** Has a message answered again: a message of yours by whoever it is for, a lead's reply by that lead. */
export function useRerunMessage(conversationId: string) {
  return useSWRMutation<void, Error, string, string>(
    `${routes.messages(conversationId)}#rerun`,
    (_key, { arg: messageId }) => sendJson<void>("POST", routes.rerun(conversationId, messageId)),
  );
}

/** Returns a function that stores a draft and keeps the cache in step, without refetching. */
export function useSaveDraft(conversationId: string) {
  const { mutate } = useSWRConfig();

  return useCallback(
    (body: string) =>
      mutate<DraftResponse>(
        routes.draft(conversationId),
        sendJson<DraftResponse>("PUT", routes.draft(conversationId), { body }),
        { revalidate: false },
      ),
    [mutate, conversationId],
  );
}

export function useSaveUiState() {
  const { mutate } = useSWRConfig();

  return useCallback(
    (patch: Partial<UiState>) =>
      mutate<UiStateResponse>(
        routes.uiState(),
        sendJson<UiStateResponse>("PATCH", routes.uiState(), patch),
        {
          revalidate: false,
          optimisticData: (current) => ({ uiState: { lastView: null, ...current?.uiState, ...patch } }),
        },
      ),
    [mutate],
  );
}

/** Returns a function that lists a project room in the sidebar, or takes it off. */
export function useSetRoomAdded() {
  const { mutate } = useSWRConfig();

  return useCallback(
    async (conversationId: string, added: boolean) => {
      const { directChat } = await sendJson<DirectChatResponse>("PATCH", routes.directChat(conversationId), {
        added,
      });
      editDirectChat(mutate, conversationId, directChat);
    },
    [mutate],
  );
}

/**
 * Creates a common room, or changes one when given its id. Either way the
 * sidecar answers with the room as it now stands, which goes into the cache.
 */
export function useSaveRoom(roomId: string | null) {
  const { mutate } = useSWRConfig();

  return useSWRMutation<Room, Error, string, CreateRoomRequest>(
    `${routes.rooms()}#save`,
    async (_key, { arg }) => {
      const { room } = roomId
        ? await sendJson<RoomResponse>("PATCH", routes.room(roomId), arg)
        : await sendJson<RoomResponse>("POST", routes.rooms(), arg);
      return room;
    },
    { onSuccess: (room) => upsertRoom(mutate, room) },
  );
}

/**
 * Sends a message into a Conduit session, as if you had typed it there and
 * pressed Enter. The reply shows up when the session's transcript is next read,
 * so that read is brought forward instead of waiting out the poll.
 */
export function useSendSessionMessage(sessionId: string) {
  const { mutate } = useSWRConfig();

  return useSWRMutation<void, Error, string, SendSessionMessageRequest>(
    routes.sessionMessage(sessionId),
    (path, { arg: message }) => sendJson<void>("POST", path, message),
    {
      onSuccess: () => {
        // Claude writes your message to its transcript a moment after it receives it.
        setTimeout(() => void mutate(routes.sessionTranscript(sessionId)), 600);
      },
    },
  );
}

/** Sends raw keystrokes to a session's terminal. Not a hook: it is called from xterm's key handler. */
export function sendSessionInput(sessionId: string, data: string): Promise<void> {
  return sendJson<void>("POST", routes.sessionInput(sessionId), { data });
}

/** Saves your edit of a persona. From then on it is what the gate reads for that agent. */
export function useSavePersona(projectId: string) {
  return useSWRMutation<PersonaResponse, Error, string, string>(
    routes.persona(projectId),
    (path, { arg: body }) => sendJson<PersonaResponse>("PUT", path, { body }),
    // The answer is the saved persona, so it goes straight into the cache the view reads.
    { populateCache: true, revalidate: false },
  );
}

// ---- Hired agents ----

/** Asks for a first draft of a new agent's instructions and persona. Nothing is stored. */
export function useDraftAgent() {
  return useSWRMutation<DraftAgentResponse, Error, string, DraftAgentRequest>(
    routes.agentDraft(),
    (path, { arg }) => sendJson<DraftAgentResponse>("POST", path, arg),
  );
}

/** Everyone you can talk to changed: the list of them, and the rooms they have. */
function useRefreshPeople() {
  const { mutate } = useSWRConfig();
  return useCallback(
    () => Promise.all([mutate(routes.projects()), mutate(routes.directChats()), mutate(routes.rooms())]),
    [mutate],
  );
}

/** Hires an agent. Resolves once the sidebar's lists include it, so it can be opened straight away. */
export function useHireAgent() {
  const refreshPeople = useRefreshPeople();

  return useSWRMutation<AgentResponse, Error, string, HireAgentRequest>(routes.agents(), async (path, { arg }) => {
    const hired = await sendJson<AgentResponse>("POST", path, arg);
    await refreshPeople();
    return hired;
  });
}

export function useSaveInstructions(agentId: string) {
  return useSWRMutation<AgentResponse, Error, string, string>(
    routes.agent(agentId),
    (path, { arg: instructions }) => sendJson<AgentResponse>("PATCH", path, { instructions }),
    { populateCache: true, revalidate: false },
  );
}

/** Lets an agent go. It leaves the sidebar and every room. Its messages stay. */
export function useDismissAgent(agentId: string) {
  const refreshPeople = useRefreshPeople();

  return useSWRMutation<void, Error, string>(`${routes.agent(agentId)}#dismiss`, async () => {
    await sendJson<void>("DELETE", routes.agent(agentId));
    await refreshPeople();
  });
}

// ---- Products ----

/**
 * Makes a product, or changes one when given its id. Resolves once the
 * sidebar's lists include the change, so the product can be opened straight away.
 */
export function useSaveProduct(productId: string | null) {
  const refreshPeople = useRefreshPeople();

  return useSWRMutation<Project, Error, string, CreateProductRequest>(
    `${routes.products()}#save`,
    async (_key, { arg }) => {
      const { product } = productId
        ? await sendJson<ProductResponse>("PATCH", routes.product(productId), { name: arg.name, repoIds: arg.repoIds })
        : await sendJson<ProductResponse>("POST", routes.products(), arg);

      await refreshPeople();
      return product;
    },
  );
}

/** Takes a product apart. Its repos stand on their own again. What was said in its room stays. */
export function useRemoveProduct(productId: string) {
  const refreshPeople = useRefreshPeople();

  return useSWRMutation<void, Error, string>(`${routes.product(productId)}#remove`, async () => {
    await sendJson<void>("DELETE", routes.product(productId));
    await refreshPeople();
  });
}
