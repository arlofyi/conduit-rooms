import type { Project, ProjectSession } from "@rooms/shared";
import { GitBranchIcon, TerminalIcon } from "@/components/Icons";
import { Badge, Button } from "@/components/ui";
import { useProjectActivity } from "@/features/workspace/useProjectActivity";
import { cn } from "@/lib/cn";
import { ProjectStatusWord, SessionStatusWord } from "./StatusMark";

interface ProjectViewProps {
  project: Project;
  /** The session picked in the sidebar, highlighted here. */
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  /** Opens the project's room, adding it to the sidebar if needed. */
  onOpenRoom: () => void;
  /** Opens the agent's persona and brief. */
  onOpenAgent: () => void;
}

/**
 * The watch view of one project: what its Conduit sessions are doing.
 * Read-only. Sessions are started, stopped and typed into in Conduit.
 */
export function ProjectView({
  project,
  selectedSessionId,
  onSelectSession,
  onOpenRoom,
  onOpenAgent,
}: ProjectViewProps) {
  const { status, sessions } = useProjectActivity(project.id);

  return (
    <>
      <header className="shrink-0 border-b border-line/60">
        <div className="drag-region" data-tauri-drag-region />
        <div className="flex items-center gap-2.5 px-5 pb-2.5">
          <h1 className="truncate text-title font-semibold text-soft">{project.displayName}</h1>
          <ProjectStatusWord status={status} className="text-note" />
          <div className="ml-auto flex gap-2">
            <Button onClick={onOpenAgent}>Persona</Button>
            <Button onClick={onOpenRoom}>Open room</Button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto w-full max-w-[720px]">
          <p className="mb-4 select-text truncate font-mono text-label text-dim" title={project.repoPath ?? undefined}>
            {project.repoPath}
          </p>

          <h2 className="mb-1.5 text-ui font-semibold text-bright">
            Sessions <span className="font-normal text-dim">{sessions.length}</span>
          </h2>

          {sessions.length === 0 ? (
            <p className="select-text text-title text-mid">
              No sessions in Conduit for this project. Start one there and it shows up here.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-card border border-line bg-sidebar/55">
              {sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  selected={session.id === selectedSessionId}
                  onSelect={() => onSelectSession(session.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

interface SessionRowProps {
  session: ProjectSession;
  selected: boolean;
  onSelect: () => void;
}

function SessionRow({ session, selected, onSelect }: SessionRowProps) {
  return (
    <li className="border-line/70 not-first:border-t">
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
        className={cn(
          // The list clips its children, so the focus ring is drawn inside the row, not around it.
          "flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left -outline-offset-2 transition-colors duration-[120ms]",
          selected ? "bg-selection" : "hover:bg-hover",
        )}
      >
        <TerminalIcon size={13} className={selected ? "text-accent" : "text-mid"} />

        <span
          className={cn(
            "min-w-0 flex-1 truncate text-title",
            session.status === "stopped" ? "text-dim" : "text-bright",
          )}
        >
          {session.name}
        </span>

        {session.role === "conductor" && <Badge tone="accent">conductor</Badge>}
        {session.branch && (
          <span className="flex min-w-0 max-w-40 items-center gap-1 text-label text-dim" title={session.branch}>
            <GitBranchIcon size={11} />
            <span className="truncate">{session.branch}</span>
          </span>
        )}
        <Badge tone="muted">{session.agent}</Badge>
        <span className="flex w-20 justify-end">
          <SessionStatusWord status={session.status} />
        </span>
      </button>
    </li>
  );
}
