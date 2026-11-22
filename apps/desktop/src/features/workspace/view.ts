/**
 * What the centre column is showing. Exactly one thing at a time.
 *
 *   channel  a common room, like #projects
 *   room     a project room: your chat with one project's lead
 *   project  the watch view: a project's Conduit sessions and what they are doing
 */
export type View =
  | { kind: "channel"; channelId: string }
  | { kind: "room"; conversationId: string }
  | { kind: "project"; projectId: string; sessionId: string | null };

/** A view as a short string, for remembering it between launches. */
export function encodeView(view: View): string {
  switch (view.kind) {
    case "channel":
      return `channel:${view.channelId}`;
    case "room":
      return `room:${view.conversationId}`;
    case "project":
      return view.sessionId ? `project:${view.projectId}/${view.sessionId}` : `project:${view.projectId}`;
  }
}

export function decodeView(encoded: string | null | undefined): View | null {
  if (!encoded) return null;

  const separator = encoded.indexOf(":");
  const kind = encoded.slice(0, separator);
  const rest = encoded.slice(separator + 1);
  if (separator === -1 || rest.length === 0) return null;

  switch (kind) {
    case "channel":
      return { kind, channelId: rest };
    case "room":
      return { kind, conversationId: rest };
    case "project": {
      const [projectId, sessionId] = rest.split("/");
      return projectId ? { kind, projectId, sessionId: sessionId || null } : null;
    }
    default:
      return null;
  }
}
