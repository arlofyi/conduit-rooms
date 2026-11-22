import {
  PROJECT_STATUS_LABEL,
  SESSION_STATUS_LABEL,
  type ProjectStatus,
  type SessionStatus,
} from "@rooms/shared";
import { PowerIcon } from "@/components/RoomsIcons";
import { Pulse } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * How a status is drawn. The word is always available as text, visible or
 * for screen readers, so a status never rests on color alone (R-UI-63).
 */

const WORD_TONE: Record<ProjectStatus | SessionStatus, string> = {
  working: "text-accent",
  needs_you: "text-warn",
  done: "text-good",
  idle: "text-dim",
  stopped: "text-dim",
};

/** A project's status as a word: "working", "needs you", "idle". */
export function ProjectStatusWord({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center gap-1.5 text-label", WORD_TONE[status], className)}>
      {status === "working" && <Pulse className="size-1.5" />}
      {PROJECT_STATUS_LABEL[status]}
    </span>
  );
}

/** A session's status as a small mark at the end of its row, as Conduit draws it. */
export function SessionStatusMark({ status }: { status: SessionStatus }) {
  const label = SESSION_STATUS_LABEL[status];

  return (
    <span title={label} className={cn("flex shrink-0 items-center", WORD_TONE[status])}>
      <span className="sr-only">{label}</span>
      {status === "working" && <Pulse className="size-1.5" />}
      {status === "needs_you" && <span aria-hidden className="size-1.5 rounded-full bg-warn" />}
      {status === "done" && <span aria-hidden className="size-1.5 rounded-full bg-good" />}
      {status === "stopped" && <PowerIcon size={11} />}
    </span>
  );
}

/** A session's status as a word, for the watch view where there is room for it. */
export function SessionStatusWord({ status }: { status: SessionStatus }) {
  return (
    <span className={cn("flex shrink-0 items-center gap-1.5 text-note", WORD_TONE[status])}>
      {status === "working" && <Pulse className="size-1.5" />}
      {SESSION_STATUS_LABEL[status]}
    </span>
  );
}
