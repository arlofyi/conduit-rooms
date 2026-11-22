import { MENTION_ALL, type Project, type Room } from "@rooms/shared";
import { useCallback, useMemo, useState } from "react";
import { HashIcon } from "@/components/RoomsIcons";
import { Avatar, Button, ErrorBoundary } from "@/components/ui";
import { Composer } from "@/features/conversation/Composer";
import { LeadStatusWord } from "@/features/conversation/ConversationHeader";
import { MessageStream } from "@/features/conversation/MessageStream";
import type { MentionOption } from "@/features/conversation/mentionQuery";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { AgentDrawer } from "@/features/agent/AgentDrawer";
import { RoomDialog } from "./RoomDialog";

/**
 * A common room: one shared conversation with the leads you put in it.
 * A lead speaks only when you tag it, with "@handle" or "@all".
 */
export function RoomView({ room }: { room: Room }) {
  const { contacts } = useWorkspace();
  const [editing, setEditing] = useState(false);
  /** The member whose persona and brief are open, if any (R-UI-48). */
  const [inspecting, setInspecting] = useState<Project | null>(null);

  const members = useMemo(() => {
    const byId = new Map(contacts.map((contact) => [contact.project.id, contact.project]));

    return room.members.flatMap((member) => {
      const project = byId.get(member.projectId);
      return project ? [{ project, leadStatus: member.leadStatus }] : [];
    });
  }, [contacts, room.members]);

  const projectOf = useCallback(
    (projectId: string) => contacts.find((contact) => contact.project.id === projectId)?.project,
    [contacts],
  );
  const joining = useMemo(
    () => members.filter((member) => member.leadStatus === "joining").map((member) => member.project),
    [members],
  );
  const mentionable = useMemo(() => mentionOptions(members.map((member) => member.project)), [members]);

  return (
    <>
      <header className="shrink-0 border-b border-line/60">
        <div className="drag-region" data-tauri-drag-region />
        <div className="flex items-center gap-1.5 px-5 pb-2.5">
          <HashIcon size={13} className="text-mid" />
          <h1 className="truncate text-title font-semibold text-soft">{room.name}</h1>

          <ul aria-label="In this room" className="ml-auto flex min-w-0 items-center gap-3 overflow-hidden">
            {members.map(({ project, leadStatus }) => (
              <li key={project.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  title={`${project.displayName}: persona and brief`}
                  onClick={() => setInspecting(project)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-row text-note text-mid hover:text-bright"
                >
                  <Avatar name={project.displayName} color={project.color} size={18} />
                  {project.handle}
                </button>
                {leadStatus !== "listening" && <LeadStatusWord status={leadStatus} />}
              </li>
            ))}
          </ul>

          <Button onClick={() => setEditing(true)}>{members.length === 0 ? "Add members" : "Members"}</Button>
        </div>
      </header>

      <ErrorBoundary name="this room" resetKey={room.id}>
        <MessageStream
          conversationId={room.id}
          projectOf={projectOf}
          joining={joining}
          emptyState={
            members.length === 0
              ? "Nobody is here yet. Add the agents and projects you want to talk to with the button above."
              : "Say what you need. Whoever it is for will answer. Use @ to pick someone, or @all for everyone."
          }
        />
      </ErrorBoundary>

      <Composer
        key={room.id}
        conversationId={room.id}
        placeholder={`Message #${room.name}`}
        mentionable={mentionable}
      />

      <RoomDialog open={editing} onClose={() => setEditing(false)} room={room} />
      <AgentDrawer project={inspecting} onClose={() => setInspecting(null)} />
    </>
  );
}

/** "@all" first, then each member (R-UI-41). "@all" is left out of an empty room. */
function mentionOptions(members: Project[]): MentionOption[] {
  if (members.length === 0) return [];

  return [
    { handle: MENTION_ALL, label: "Everyone in this room" },
    ...members.map((project) => ({ handle: project.handle, label: project.displayName })),
  ];
}
