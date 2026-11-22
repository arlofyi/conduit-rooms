import type { DirectChat, Project } from "@rooms/shared";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useSaveUiState } from "@/api/mutations";
import { useDirectChats, useProjects, useUiState } from "@/api/queries";
import { useWorkspaceEvents } from "@/api/workspaceEvents";
import { WorkspaceContext, type Contact } from "./useWorkspace";
import { decodeView, encodeView, type View } from "./view";

interface WorkspaceProviderProps {
  /** Shown until the first load finishes. */
  loading: ReactNode;
  /** Shown when the first load fails. `retry` runs it again. */
  renderError: (error: Error, retry: () => void) => ReactNode;
  children: ReactNode;
}

/**
 * Loads what every screen needs (projects, their rooms, and what was open
 * last time), keeps it live, and hands it down. Screens below read it with
 * useWorkspace() instead of each fetching and joining it again.
 */
export function WorkspaceProvider({ loading, renderError, children }: WorkspaceProviderProps) {
  const projects = useProjects();
  const directChats = useDirectChats();
  const uiState = useUiState();
  const saveUiState = useSaveUiState();
  const connection = useWorkspaceEvents();

  // Null until you open something this session. Until then, last session's view stands.
  const [opened, setOpened] = useState<View | null>(null);

  const contacts = useMemo(
    () => joinContacts(projects.data?.projects, directChats.data?.directChats),
    [projects.data, directChats.data],
  );

  const restored = useMemo(() => decodeView(uiState.data?.uiState.lastView), [uiState.data]);
  const view = opened ?? restored;

  const open = useCallback(
    (next: View) => {
      setOpened(next);
      void saveUiState({ lastView: encodeView(next) });
    },
    [saveUiState],
  );

  const workspace = useMemo(() => ({ contacts, view, open, connection }), [contacts, view, open, connection]);

  const error = projects.error ?? directChats.error;
  const hasData = projects.data && directChats.data;

  if (!hasData && error) {
    return renderError(error, () => {
      void projects.mutate();
      void directChats.mutate();
    });
  }
  if (!hasData || uiState.isLoading) return loading;

  return <WorkspaceContext value={workspace}>{children}</WorkspaceContext>;
}

function joinContacts(projects: Project[] = [], chats: DirectChat[] = []): Contact[] {
  const chatByProject = new Map(chats.map((chat) => [chat.projectId, chat]));

  return projects.flatMap((project) => {
    const chat = chatByProject.get(project.id);
    return chat ? [{ project, chat }] : [];
  });
}
