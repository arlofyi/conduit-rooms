import type { ProjectActivity } from "@rooms/shared";
import { useMemo } from "react";
import { useActivity } from "@/api/queries";

const NO_ACTIVITY: Omit<ProjectActivity, "projectId"> = { status: "idle", sessions: [] };

/**
 * What one project's Conduit sessions are doing. Every caller shares the
 * same polled request, so a sidebar of thirty projects still makes one call.
 */
export function useProjectActivity(projectId: string): ProjectActivity {
  const { data } = useActivity();

  return useMemo(
    () => data?.activity.find((entry) => entry.projectId === projectId) ?? { projectId, ...NO_ACTIVITY },
    [data, projectId],
  );
}
