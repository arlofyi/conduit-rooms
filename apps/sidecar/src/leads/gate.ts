import type { Message, Project } from "@rooms/shared";

/**
 * The gate: decides which leads, if any, should reply to a message that
 * neither tags nor names anyone and does not say "you" to the lead who just
 * spoke. Those three cases are settled by string checks in channelService.ts
 * and never reach here.
 *
 * The gate classifies. It cannot write a reply, and a lead is never asked
 * whether it wants to speak: a model that has been woken always says
 * something, so the decision has to be made before it is (principle P2,
 * specs/07-speaking-policy.md).
 *
 * It looks at every member of the room together and picks between them. An
 * earlier version asked about each lead on its own ("is this about
 * Conduit?"), and with nothing to compare against, a vaguely technical
 * question scored middling for every lead. Asked "which of these is it for?",
 * the right lead only has to fit better than the others.
 */
export interface Gate {
  decide(question: GateQuestion): Promise<GateDecision>;
}

export interface GateQuestion {
  roomName: string;
  /** Everyone in the room, each with the persona the gate judges it by. */
  members: readonly GateMember[];
  /** The messages before the new one, oldest first. */
  recent: readonly Message[];
  message: string;
}

export interface GateMember {
  project: Project;
  /** What this agent is and what to ask it about. Null before it has a persona. */
  persona: string | null;
}

export interface GateDecision {
  /** The leads that should reply. Empty means the message is for nobody. */
  speakers: Project[];
  /** Why, in a line, for the event log. This is what the gate is tuned from. */
  reason: string;
  latencyMs: number;
  /** True when the gate could not answer. `speakers` is then empty and means nothing. */
  unavailable: boolean;
}

/** What the gate is told about a member that has no persona yet: only its name. */
export function describeMember({ project, persona }: GateMember): string {
  return persona ?? `${project.displayName} (handle: ${project.handle}), a software project.`;
}

export function unavailableDecision(reason: string, latencyMs: number): GateDecision {
  return { speakers: [], reason, latencyMs, unavailable: true };
}

/** Long text is cut for the gate. Who a message is for shows in its first lines. */
export function clip(text: string, max = 600): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}...` : flat;
}
