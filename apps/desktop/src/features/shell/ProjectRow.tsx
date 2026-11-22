import type { ProjectStatus } from "@rooms/shared";
import { FolderIcon, TerminalIcon } from "@/components/Icons";
import { ProjectStatusWord, SessionStatusMark } from "@/features/project/StatusMark";
import { useProjectActivity } from "@/features/workspace/useProjectActivity";
import { useWorkspace, type Contact } from "@/features/workspace/useWorkspace";
import { useStoredFlag } from "@/lib/useStoredFlag";
import { LeadActivity } from "./LeadActivity";
import { SidebarRow } from "./SidebarRow";
import { TreeChildren, TreeRow } from "./TreeRow";

interface ProjectRowProps {
  contact: Contact;
  /** True for a repo drawn under its product: lighter, and without a folder mark of its own. */
  nested?: boolean;
}

/**
 * One project, listed once. Clicking it opens your room with its lead and
 * shows what Conduit is running in it, and a session there opens to look
 * inside. The arrow shows or hides the sessions without leaving the room you
 * are in. A project that is busy starts out open.
 */
export function ProjectRow({ contact, nested = false }: ProjectRowProps) {
  const { project, chat } = contact;
  const { view, open } = useWorkspace();
  const { status, sessions } = useProjectActivity(project.id);
  const [expanded, setExpanded] = useStoredFlag(`rooms.project.${project.id}.open`, status !== "idle");

  const watching = view?.kind === "project" && view.projectId === project.id;
  const selectedSessionId = watching ? view.sessionId : null;
  const selected = (view?.kind === "room" && view.conversationId === chat.id) || (watching && !selectedSessionId);

  return (
    <li>
      <TreeRow
        label={nested ? project.handle : project.displayName}
        strong={!nested}
        leading={!nested && <FolderMark color={project.color} />}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
        selected={selected}
        onSelect={() => {
          // The first click opens the room and what is under it. A click on the open room folds it again.
          setExpanded(selected ? !expanded : true);
          open({ kind: "room", conversationId: chat.id });
        }}
        trailing={<RowStatus status={status} contact={contact} />}
      />

      {expanded && (
        <TreeChildren>
          {sessions.length === 0 && <li className="px-[7px] py-1 text-ui text-dim">No sessions</li>}

          {sessions.map((session) => (
            <li key={session.id}>
              <SidebarRow
                label={session.name}
                muted={session.status === "stopped"}
                selected={session.id === selectedSessionId}
                leading={
                  <TerminalIcon size={12} className={session.id === selectedSessionId ? "text-accent" : "text-mid"} />
                }
                trailing={<SessionStatusMark status={session.status} />}
                onSelect={() => open({ kind: "project", projectId: project.id, sessionId: session.id })}
              />
            </li>
          ))}
        </TreeChildren>
      )}
    </li>
  );
}

export function FolderMark({ color }: { color: string }) {
  return (
    <span style={{ color }} className="flex">
      <FolderIcon size={12} />
    </span>
  );
}

/** What Conduit is doing in a project if anything, and otherwise whether its lead is talking. */
export function RowStatus({ status, contact }: { status: ProjectStatus; contact: Contact }) {
  return status === "idle" ? <LeadActivity contact={contact} /> : <ProjectStatusWord status={status} />;
}
