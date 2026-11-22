import type { Project, ProjectSession } from "@rooms/shared";
import { ChevronRightIcon } from "@/components/Icons";
import { Badge, ErrorBoundary, Segmented } from "@/components/ui";
import { SessionStatusWord } from "@/features/project/StatusMark";
import { useStoredChoice } from "@/lib/useStoredChoice";
import { SessionChat } from "./SessionChat";
import { SessionTerminal } from "./SessionTerminal";

type Mode = "chat" | "terminal";

const MODES = [
  { value: "chat", label: "Chat" },
  { value: "terminal", label: "Terminal" },
] satisfies Array<{ value: Mode; label: string }>;

interface SessionViewProps {
  project: Project;
  session: ProjectSession;
  /** Goes back to the project's list of sessions. */
  onBack: () => void;
}

/**
 * One Conduit session, opened as a chat or as its terminal. You can type
 * into either, and what you type goes to the real session in Conduit.
 * The choice of view is remembered.
 */
export function SessionView({ project, session, onBack }: SessionViewProps) {
  const [mode, setMode] = useStoredChoice<Mode>("rooms.session.view", "chat", ["chat", "terminal"]);

  return (
    <>
      <header className="shrink-0 border-b border-line/60">
        <div className="drag-region" data-tauri-drag-region />
        <div className="flex items-center gap-2 px-5 pb-2.5">
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 cursor-pointer rounded-row text-title text-mid hover:text-bright"
          >
            {project.displayName}
          </button>
          <ChevronRightIcon size={11} className="text-dim" />
          <h1 className="min-w-0 truncate text-title font-semibold text-soft">{session.name}</h1>
          <SessionStatusWord status={session.status} />
          {session.role === "conductor" && <Badge tone="accent">conductor</Badge>}

          <div className="ml-auto">
            <Segmented label="View" value={mode} options={MODES} onChange={setMode} />
          </div>
        </div>
      </header>

      <ErrorBoundary name="this session" resetKey={`${session.id}:${mode}`}>
        {mode === "chat" ? (
          <SessionChat key={session.id} project={project} session={session} />
        ) : (
          <SessionTerminal key={session.id} session={session} />
        )}
      </ErrorBoundary>
    </>
  );
}
