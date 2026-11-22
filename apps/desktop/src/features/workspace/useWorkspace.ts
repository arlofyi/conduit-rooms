import type { DirectChat, Project } from "@rooms/shared";
import { createContext, use } from "react";
import type { Connection } from "@/api/workspaceEvents";
import type { View } from "./view";

/** A project together with its room. The two always come as a pair (invariant I1). */
export interface Contact {
  project: Project;
  chat: DirectChat;
}

export interface Workspace {
  /** Every project, in the order Conduit lists them. */
  contacts: Contact[];
  /** What the centre column is showing, or null when nothing is open. */
  view: View | null;
  open: (view: View) => void;
  connection: Connection;
}

/**
 * Lives in its own file on purpose. During development a file is re-run
 * when it changes, and a context created in a file that changes often would
 * be a new context each time, leaving the screens below reading an old one.
 */
export const WorkspaceContext = createContext<Workspace | null>(null);

/** What every screen needs: the projects, what is open, and how to open something else. */
export function useWorkspace(): Workspace {
  const workspace = use(WorkspaceContext);
  if (!workspace) throw new Error("useWorkspace must be used inside <WorkspaceProvider>.");
  return workspace;
}
