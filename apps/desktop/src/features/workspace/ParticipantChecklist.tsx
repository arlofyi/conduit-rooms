import { Checkbox } from "@headlessui/react";
import type { Project } from "@rooms/shared";
import { useId, useMemo, useState, type ReactNode } from "react";
import { CheckIcon } from "@/components/RoomsIcons";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/cn";

interface ParticipantChecklistProps {
  /** What is being chosen, as a heading: "Who is in this room". */
  label: string;
  /** Everyone who can be ticked, in the order to list them. */
  options: readonly Project[];
  chosenIds: readonly string[];
  onToggle: (projectId: string) => void;
  filterPlaceholder: string;
  /** Something to show beside one option's name: a badge saying what it is, or where it is now. */
  note?: (project: Project) => ReactNode;
}

/**
 * A searchable list of projects and agents with a tick box each. Used
 * wherever you pick several of them: a room's members, a product's repos.
 */
export function ParticipantChecklist({
  label,
  options,
  chosenIds,
  onToggle,
  filterPlaceholder,
  note,
}: ParticipantChecklistProps) {
  const [filter, setFilter] = useState("");
  const labelId = useId();

  const shown = useMemo(() => filterByName(options, filter), [options, filter]);
  const chosen = useMemo(() => new Set(chosenIds), [chosenIds]);

  return (
    // A div, not a fieldset: a fieldset will not shrink inside a flex column, so its list would spill out.
    <div role="group" aria-labelledby={labelId} className="flex min-h-0 flex-col gap-1.5">
      <p id={labelId} className="flex items-baseline text-ui font-medium text-bright">
        {label}
        <span className="ml-auto font-normal text-mid">{chosenIds.length} chosen</span>
      </p>

      <input
        type="search"
        value={filter}
        placeholder={filterPlaceholder}
        aria-label={filterPlaceholder}
        onChange={(event) => setFilter(event.target.value)}
        className="h-[26px] rounded-control border border-line bg-sidebar px-2 text-ui text-bright outline-none placeholder:text-dim focus:border-accent"
      />

      <ul className="h-[38vh] min-h-24 overflow-y-auto rounded-card border border-line bg-sidebar/55 p-1">
        {shown.map((project) => (
          <li key={project.id}>
            <Checkbox
              checked={chosen.has(project.id)}
              onChange={() => onToggle(project.id)}
              className="group flex w-full cursor-pointer items-center gap-2 rounded-row px-2 py-[5px] text-ui text-mid data-checked:text-bright data-focus:bg-hover data-hover:bg-hover"
            >
              <span
                className={cn(
                  "flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-100",
                  chosen.has(project.id) ? "border-accent bg-accent text-panel" : "border-line-strong",
                )}
              >
                {chosen.has(project.id) && <CheckIcon size={10} />}
              </span>
              <Avatar name={project.displayName} color={project.color} size={16} />
              <span className="min-w-0 flex-1 truncate">{project.displayName}</span>
              {note?.(project)}
              <span className="font-mono text-label text-dim">@{project.handle}</span>
            </Checkbox>
          </li>
        ))}
        {shown.length === 0 && <li className="px-2 py-2 text-ui text-dim">Nobody matches.</li>}
      </ul>
    </div>
  );
}

function filterByName(options: readonly Project[], filter: string): readonly Project[] {
  const needle = filter.trim().toLowerCase();
  if (!needle) return options;

  return options.filter(
    (project) => project.handle.includes(needle) || project.displayName.toLowerCase().includes(needle),
  );
}

/** Adds an id to a list of chosen ids, or takes it out. The order of ticking is kept. */
export function toggleId(chosenIds: readonly string[], id: string): string[] {
  return chosenIds.includes(id) ? chosenIds.filter((chosen) => chosen !== id) : [...chosenIds, id];
}
