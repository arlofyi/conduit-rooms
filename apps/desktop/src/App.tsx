import { useState } from "react";
import { SWRConfig } from "swr";
import { SidecarUnreachableError } from "@/api/client";
import { ChatBubbleIcon } from "@/components/Icons";
import { Button, EmptyState, ErrorBoundary, Notice, Skeleton } from "@/components/ui";
import { useSetRoomAdded } from "@/api/mutations";
import { useRooms } from "@/api/queries";
import { AgentDrawer } from "@/features/agent/AgentDrawer";
import { DirectChatView } from "@/features/conversation/DirectChatView";
import { ProjectView } from "@/features/project/ProjectView";
import { RoomView } from "@/features/room/RoomView";
import { SessionView } from "@/features/session/SessionView";
import { useProjectActivity } from "@/features/workspace/useProjectActivity";
import { AppShell } from "@/features/shell/AppShell";
import { Sidebar } from "@/features/shell/Sidebar";
import { useWorkspace, type Contact } from "@/features/workspace/useWorkspace";
import { encodeView } from "@/features/workspace/view";
import { WorkspaceProvider } from "@/features/workspace/WorkspaceProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";

/**
 * The provider stack, outermost first:
 *
 *   ThemeProvider      which of Conduit's themes is on screen
 *   SWRConfig          one cache for everything read from the sidecar
 *   WorkspaceProvider  projects, their chats, the selection, and live events
 *
 * Below them is the shell. Every region sits in its own error boundary.
 */
export default function App() {
  return (
    <ThemeProvider>
      <SWRConfig value={{ shouldRetryOnError: false }}>
        <ErrorBoundary name="the app">
          <WorkspaceProvider
            loading={<AppShell sidebar={<SidebarSkeleton />}>{null}</AppShell>}
            renderError={(error, retry) => <StartupError error={error} onRetry={retry} />}
          >
            <Workspace />
          </WorkspaceProvider>
        </ErrorBoundary>
      </SWRConfig>
    </ThemeProvider>
  );
}

function Workspace() {
  const { connection, view } = useWorkspace();

  return (
    <AppShell
      sidebar={
        <ErrorBoundary name="the sidebar">
          <Sidebar />
        </ErrorBoundary>
      }
    >
      {connection === "reconnecting" && (
        <Notice tone="warn" className="m-2 mt-[calc(var(--titlebar-h)+4px)]">
          Reconnecting to the sidecar. New replies will appear once it is back.
        </Notice>
      )}

      {/* Keyed by what is open, so each view fades in as you arrive at it. */}
      <div key={view ? encodeView(view) : "nothing"} className="flex min-h-0 flex-1 animate-fade-in flex-col">
        <CentreView />
      </div>
    </AppShell>
  );
}

/** Draws whichever view is open: a common room, a project room, or a project's watch view. */
function CentreView() {
  const { view, contacts, open } = useWorkspace();
  const setRoomAdded = useSetRoomAdded();
  const rooms = useRooms();

  if (view?.kind === "channel") {
    const room = rooms.data?.rooms.find((entry) => entry.id === view.channelId);
    if (room) return <RoomView room={room} />;
    // Still loading the room list. Draw nothing for a beat instead of the wrong screen.
    if (rooms.isLoading) return null;
  }

  if (view?.kind === "room") {
    const contact = contacts.find((entry) => entry.chat.id === view.conversationId);
    if (contact) return <DirectChatView contact={contact} />;
  }

  if (view?.kind === "project") {
    const contact = contacts.find((entry) => entry.project.id === view.projectId);
    if (contact) {
      return (
        <ErrorBoundary name="this project" resetKey={contact.project.id}>
          <WatchView
            contact={contact}
            sessionId={view.sessionId}
            onOpenSession={(sessionId) => open({ kind: "project", projectId: contact.project.id, sessionId })}
            onOpenRoom={async () => {
              if (!contact.chat.addedAt) await setRoomAdded(contact.chat.id, true);
              open({ kind: "room", conversationId: contact.chat.id });
            }}
          />
        </ErrorBoundary>
      );
    }
  }

  return (
    <EmptyState icon={<ChatBubbleIcon size={34} />} title="Talk to a project">
      Add a project room on the left to talk to its lead, or pick a project to see what it is doing.
    </EmptyState>
  );
}

interface WatchViewProps {
  contact: Contact;
  sessionId: string | null;
  onOpenSession: (sessionId: string | null) => void;
  onOpenRoom: () => void;
}

/** The watch side of a project: its list of sessions, or one session opened to look inside. */
function WatchView({ contact, sessionId, onOpenSession, onOpenRoom }: WatchViewProps) {
  const { project } = contact;
  const { sessions } = useProjectActivity(project.id);
  const session = sessions.find((entry) => entry.id === sessionId);
  const [agentOpen, setAgentOpen] = useState(false);

  if (session) {
    return <SessionView project={project} session={session} onBack={() => onOpenSession(null)} />;
  }

  return (
    <>
      <ProjectView
        project={project}
        selectedSessionId={null}
        onSelectSession={onOpenSession}
        onOpenRoom={onOpenRoom}
        onOpenAgent={() => setAgentOpen(true)}
      />
      <AgentDrawer project={agentOpen ? project : null} onClose={() => setAgentOpen(false)} />
    </>
  );
}

function StartupError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const unreachable = error instanceof SidecarUnreachableError;

  return (
    <AppShell sidebar={null}>
      <EmptyState
        title={unreachable ? "Rooms cannot reach its sidecar" : "Rooms could not load your projects"}
        action={
          <Button variant="primary" size="md" onClick={onRetry}>
            Try again
          </Button>
        }
      >
        {unreachable
          ? "The sidecar is the process that holds your conversations and runs the leads. Start it with pnpm dev, then try again."
          : error.message}
      </EmptyState>
    </AppShell>
  );
}

const SKELETON_ROWS = ["70%", "52%", "64%", "44%", "58%", "66%"];

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 p-3.5" aria-hidden>
      {SKELETON_ROWS.map((width) => (
        <Skeleton key={width} className="h-2.5" style={{ width }} />
      ))}
    </div>
  );
}
