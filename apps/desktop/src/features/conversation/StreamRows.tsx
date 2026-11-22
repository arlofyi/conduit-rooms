import type { Message, Project, RepoProgress } from "@rooms/shared";
import { useJoinProgress } from "@/api/liveJoining";
import { CheckIcon } from "@/components/RoomsIcons";
import { Avatar, Skeleton, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/time";

/** The small rows of a message stream that are not messages from a person or a lead. */

/** A line across the stream where the day changes (Conduit's .hq-divider). */
export function DayDivider({ at }: { at: string }) {
  return (
    <div role="separator" className="flex items-center gap-3 text-label text-mid">
      <span className="h-px flex-1 bg-line" />
      {formatDay(at)}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** An event in the conversation, centred and muted (Conduit's .hq-note). */
export function SystemRow({ message }: { message: Message }) {
  return (
    <div className="flex animate-rise-in justify-center">
      <span className="inline-flex max-w-full items-center rounded-full border border-line/60 bg-selection/40 px-3 py-[3px] text-note text-mid">
        {message.body}
      </span>
    </div>
  );
}

/**
 * Stands in for a lead's reply while it reads its project for the first time
 * (R-LEAD-11), and says what it is reading. A product's lead reads several
 * repos side by side, so each of them gets a tile of its own.
 */
export function JoiningRow({ project, conversationId }: { project: Project; conversationId: string }) {
  const progress = useJoinProgress(conversationId, project.id);
  const repos = progress?.repos ?? [];
  const read = repos.filter((repo) => repo.state === "done").length;

  const doing = progress?.doing ?? (repos.length > 0 ? `reading its repos, ${read} of ${repos.length}` : "joining");

  return (
    <div className="flex animate-rise-in gap-3" role="status">
      <Avatar name={project.displayName} color={project.color} className="mt-0.5" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-title font-semibold text-bright">{project.displayName}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-note text-mid">
            <Spinner size={11} />
            <span className="truncate">{doing}</span>
          </span>
        </div>

        {repos.length > 0 && (
          <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-1.5">
            {repos.map((repo) => (
              <RepoTile key={repo.handle} repo={repo} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const REPO_STATE_WORD: Record<RepoProgress["state"], string> = {
  waiting: "waiting",
  reading: "reading",
  done: "brief written",
  failed: "could not be read",
};

function RepoTile({ repo }: { repo: RepoProgress }) {
  return (
    <li
      className={cn(
        "min-w-0 animate-pop-in rounded-control border px-2 py-1 text-label transition-[border-color,opacity] duration-300",
        repo.state === "reading" ? "border-accent-line" : "border-line",
        repo.state === "waiting" && "opacity-55",
      )}
    >
      <span className="flex items-center gap-1 text-ui text-bright">
        {repo.state === "done" && <CheckIcon size={10} className="shrink-0 animate-pop-in text-good" />}
        <span className="truncate">{repo.handle}</span>
      </span>
      <span className={cn("block truncate", repo.state === "failed" ? "text-bad" : "text-mid")}>
        {repo.doing ?? REPO_STATE_WORD[repo.state]}
      </span>
    </li>
  );
}

const SKELETON_WIDTHS = ["62%", "88%", "40%", "74%"];

/** Shown while a conversation's history loads. */
export function StreamSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      {SKELETON_WIDTHS.map((width, index) => (
        <div key={width} className="flex gap-3">
          <Skeleton className="size-7 rounded-[28%]" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-2.5" style={{ width }} />
            {index % 2 === 0 && <Skeleton className="h-2.5 w-1/3" />}
          </div>
        </div>
      ))}
    </div>
  );
}
