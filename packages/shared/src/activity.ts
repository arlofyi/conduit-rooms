import type { ProjectSession, ProjectStatus, SessionStatus } from "./entities";

/**
 * Turns what Conduit records about a session into the one status Rooms shows.
 * Conduit keeps `agentState` up to date from the agent's hooks, and `stopped`
 * for a session whose terminal is not running.
 */
export function sessionStatus(agentState: string | null | undefined, stopped: boolean): SessionStatus {
  if (stopped) return "stopped";

  switch (agentState) {
    case "running":
      return "working";
    case "needsInput":
      return "needs_you";
    case "done":
      return "done";
    default:
      return "idle";
  }
}

/** A project needs you if any session does, is working if any session is, and is idle otherwise. */
export function projectStatus(sessions: readonly Pick<ProjectSession, "status">[]): ProjectStatus {
  if (sessions.some((session) => session.status === "needs_you")) return "needs_you";
  if (sessions.some((session) => session.status === "working")) return "working";
  return "idle";
}

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  working: "working",
  needs_you: "needs you",
  done: "done",
  idle: "idle",
  stopped: "stopped",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  working: "working",
  needs_you: "needs you",
  idle: "idle",
};
