import { Button } from "@headlessui/react";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "@/components/Icons";
import { cn } from "@/lib/cn";

interface SidebarRowProps {
  label: string;
  /** Shown before the label. */
  leading?: ReactNode;
  /** Shown at the right edge: a status, an activity indicator. */
  trailing?: ReactNode;
  selected?: boolean;
  /** Dims the label, for something that is there but not running. */
  muted?: boolean;
  /** An action row such as "Add room": drawn in the accent color. */
  action?: boolean;
  onSelect: () => void;
}

/** One row in the sidebar (Conduit's .session-row): 12px text, 5px radius, one line. */
export function SidebarRow({
  label,
  leading,
  trailing,
  selected = false,
  muted = false,
  action = false,
  onSelect,
}: SidebarRowProps) {
  return (
    <Button
      onClick={onSelect}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "flex w-full cursor-pointer items-center gap-[7px] rounded-row px-[7px] py-1 text-left text-ui transition-[color,background-color,scale] duration-[120ms] active:scale-[0.985]",
        selected ? "bg-selection" : "data-hover:bg-hover",
        action ? "text-accent" : muted ? "text-dim" : "text-bright",
      )}
    >
      {leading}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </Button>
  );
}

interface SidebarFoldProps {
  /** What is folded away: "Quiet", "6 quiet repos". */
  label: string;
  /** How many rows are inside, when the label does not already say. */
  count?: number;
  open: boolean;
  onToggle: () => void;
}

/** A dim row that opens and closes a group of rows you rarely need. */
export function SidebarFold({ label, count, open, onToggle }: SidebarFoldProps) {
  return (
    <Button
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full cursor-pointer items-center gap-[7px] rounded-row px-[7px] py-1 text-left text-ui text-mid transition-[color,background-color,scale] duration-[120ms] active:scale-[0.985] data-hover:bg-hover data-hover:text-bright"
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className="text-label tabular-nums text-dim">{count}</span>}
      <ChevronRightIcon size={12} className={cn("text-dim transition-transform duration-150 ease-settle", open && "rotate-90")} />
    </Button>
  );
}

/** The small heading above a group of rows (Conduit's .section-label), with room for one control at its right. */
export function SidebarSectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center px-[7px] pb-0.5 pt-2">
      <h2 className="flex-1 text-label font-normal text-dim">{children}</h2>
      {action}
    </div>
  );
}
