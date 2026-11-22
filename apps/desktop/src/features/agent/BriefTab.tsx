import type { Project } from "@rooms/shared";
import { useMemo } from "react";
import { useBrief } from "@/api/queries";
import { Button, Notice, Skeleton } from "@/components/ui";
import { renderMarkdown } from "@/lib/markdown";
import { formatFull } from "@/lib/time";

/**
 * The lead's brief, read-only (R-UI-50): everything a lead knows about its
 * project before it looks at the repo. It is the lead's own memory. What
 * decides whether a message reaches the lead at all is the persona.
 */
export function BriefTab({ project }: { project: Project }) {
  const { data, error, isLoading, mutate } = useBrief(project.id);
  const brief = data?.brief;
  const html = useMemo(() => (brief ? renderMarkdown(brief.body) : ""), [brief]);

  if (isLoading) return <TabSkeleton />;

  if (error) {
    return (
      <Notice tone="error" actions={<Button onClick={() => void mutate()}>Try again</Button>}>
        The brief could not be loaded.
      </Notice>
    );
  }

  if (!brief) {
    return (
      <p className="select-text text-title leading-normal text-mid">
        No brief yet. {project.displayName} writes one the first time you message it.
      </p>
    );
  }

  return (
    <>
      <p className="mb-3 text-badge text-dim">
        Version {brief.version}, written {formatFull(brief.writtenAt)}
      </p>
      {/* Safe: renderMarkdown sanitizes against an allowlist (lib/markdown.ts). */}
      <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}

/** Shown in either tab while its document loads. */
export function TabSkeleton() {
  return (
    <div className="flex flex-col gap-2.5" aria-hidden>
      <Skeleton className="h-3 w-2/5" />
      <Skeleton className="h-2.5 w-full" />
      <Skeleton className="h-2.5 w-11/12" />
      <Skeleton className="h-2.5 w-3/5" />
    </div>
  );
}
