import type { Project } from "@rooms/shared";
import { Drawer, Segmented } from "@/components/ui";
import { useStoredChoice } from "@/lib/useStoredChoice";
import { BriefTab } from "./BriefTab";
import { InstructionsTab } from "./InstructionsTab";
import { PersonaTab } from "./PersonaTab";

/** The second tab is the document the agent itself reads: a lead's brief, or a hired agent's instructions. */
type Tab = "persona" | "own";

const tabsFor = (project: Project): Array<{ value: Tab; label: string }> => [
  { value: "persona", label: "Persona" },
  { value: "own", label: project.kind === "hired" ? "Instructions" : "Brief" },
];

interface AgentDrawerProps {
  /** The agent to show. Null keeps the drawer closed. */
  project: Project | null;
  onClose: () => void;
}

/**
 * Everything written down about one agent, in two tabs:
 *
 *   Persona       what it is and what to ask it about. The gate reads this. You can edit it.
 *   Brief         for a project or a product: what its lead knows about it. Read-only.
 *   Instructions  for an agent you hired: what you told it to be. You can edit it.
 */
export function AgentDrawer({ project, onClose }: AgentDrawerProps) {
  const [tab, setTab] = useStoredChoice<Tab>("rooms.agent.tab", "persona", ["persona", "own"]);

  return (
    <Drawer
      open={project !== null}
      onClose={onClose}
      title={project?.displayName ?? ""}
      subtitle={project ? `@${project.handle}` : undefined}
    >
      {/* Mounted only while open, so each opening fetches the documents fresh. */}
      {project && (
        <div className="flex flex-col gap-4 p-4">
          <Segmented label="Document" value={tab} options={tabsFor(project)} onChange={setTab} />
          {/* Keyed by tab, so the document fades in each time you switch. */}
          <div key={tab} className="animate-fade-in">
            {tab === "persona" && <PersonaTab key={project.id} project={project} />}
            {tab === "own" && project.kind !== "hired" && <BriefTab project={project} />}
            {tab === "own" && project.kind === "hired" && (
              <InstructionsTab key={project.id} agent={project} onDismissed={onClose} />
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
