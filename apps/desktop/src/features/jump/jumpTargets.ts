import type { ProjectActivity, Room } from "@rooms/shared";
import type { Contact } from "@/features/workspace/useWorkspace";
import type { View } from "@/features/workspace/view";

/** One place you can jump to: a room, a lead, an agent, or a session running in Conduit. */
export interface JumpTarget {
  id: string;
  kind: "room" | "product" | "project" | "agent" | "session";
  /** What you would type to find it. */
  label: string;
  /** Where it belongs, shown dimmed beside the label: a session's project, a repo's product. */
  context: string | null;
  view: View;
}

/** Where each kind of contact sits among the others: the few you made yourself before the many from Conduit. */
const CONTACT_ORDER = { hired: 0, product: 1, project: 2 } as const;

/** Everything that can be jumped to, in the order shown when nothing has been typed. */
export function listJumpTargets(
  rooms: readonly Room[],
  contacts: readonly Contact[],
  activity: readonly ProjectActivity[],
): JumpTarget[] {
  const nameOf = new Map(contacts.map(({ project }) => [project.id, project.displayName]));

  const roomTargets = rooms.map<JumpTarget>((room) => ({
    id: room.id,
    kind: "room",
    label: room.name,
    context: null,
    view: { kind: "channel", channelId: room.id },
  }));

  const byKind = [...contacts].sort((a, b) => CONTACT_ORDER[a.project.kind] - CONTACT_ORDER[b.project.kind]);
  const people = byKind.map<JumpTarget>(({ project, chat }) => ({
    id: chat.id,
    kind: project.kind === "hired" ? "agent" : project.kind,
    label: project.displayName,
    context: project.productId ? (nameOf.get(project.productId) ?? null) : null,
    view: { kind: "room", conversationId: chat.id },
  }));

  const sessions = activity.flatMap(({ projectId, sessions: running }) =>
    running.map<JumpTarget>((session) => ({
      id: session.id,
      kind: "session",
      label: session.name,
      context: nameOf.get(projectId) ?? null,
      view: { kind: "project", projectId, sessionId: session.id },
    })),
  );

  return [...roomTargets, ...people, ...sessions];
}

/**
 * The targets that match what was typed, best first: labels that start with
 * it, then labels that contain it, then ones whose context does ("arlo"
 * finds every repo and session under Arlo). Order within each group is kept.
 */
export function matchJumpTargets(targets: readonly JumpTarget[], typed: string): JumpTarget[] {
  const needle = typed.trim().toLowerCase();
  if (!needle) return [...targets];

  const rank = (target: JumpTarget): number => {
    const label = target.label.toLowerCase();
    if (label.startsWith(needle)) return 0;
    if (label.includes(needle)) return 1;
    return target.context?.toLowerCase().includes(needle) ? 2 : 3;
  };

  return targets
    .map((target) => ({ target, rank: rank(target) }))
    .filter((scored) => scored.rank < 3)
    .sort((a, b) => a.rank - b.rank)
    .map((scored) => scored.target);
}
