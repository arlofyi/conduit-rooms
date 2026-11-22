import type { Message, Project, ReplyStep } from "@rooms/shared";
import { ChevronRightIcon, TerminalIcon } from "@/components/Icons";
import { SessionStatusMark } from "@/features/project/StatusMark";
import { useProjectActivity } from "@/features/workspace/useProjectActivity";
import { useWorkspace } from "@/features/workspace/useWorkspace";

/**
 * The sessions a reply started in Conduit, each as a card under it. A card
 * opens the session, to watch it work or to type into it.
 *
 * Nothing is stored for these: they are read off the reply's own steps, and
 * each card finds its session in what Conduit is running right now.
 */
export function StartedSessions({ message }: { message: Message }) {
  const { contacts } = useWorkspace();
  const started = (message.steps ?? []).filter((step) => step.kind === "start_session" && step.label);
  if (started.length === 0) return null;

  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {started.map((step, index) => {
        const project = contacts.find((contact) => contact.project.handle === step.subject)?.project;
        return project ? <SessionCard key={index} step={step} project={project} /> : null;
      })}
    </ul>
  );
}

function SessionCard({ step, project }: { step: ReplyStep; project: Project }) {
  const { open } = useWorkspace();
  const { sessions } = useProjectActivity(project.id);

  // Conduit hands back no id when it starts a session, so it is found again by the name it was given.
  const session = sessions.findLast((candidate) => candidate.name === step.label);

  return (
    <li className="animate-pop-in">
      <button
        type="button"
        onClick={() => open({ kind: "project", projectId: project.id, sessionId: session?.id ?? null })}
        className="group/card flex max-w-80 cursor-pointer items-center gap-2.5 rounded-card border border-line bg-sidebar/70 py-2 pl-2 pr-3 text-left transition-[border-color,background-color,translate,box-shadow] duration-200 ease-settle hover:-translate-y-0.5 hover:border-accent-line hover:bg-accent-wash hover:shadow-menu active:translate-y-0"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
          <TerminalIcon size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ui font-medium text-bright">{step.label}</span>
          <span className="flex items-center gap-1.5 text-label text-mid">
            {session ? (
              <>
                Session in {project.handle}
                <SessionStatusMark status={session.status} />
              </>
            ) : (
              `Not running in ${project.handle} now`
            )}
          </span>
        </span>
        <ChevronRightIcon
          size={13}
          className="shrink-0 text-dim transition-[translate,color] duration-200 ease-settle group-hover/card:translate-x-0.5 group-hover/card:text-accent"
        />
      </button>
    </li>
  );
}
