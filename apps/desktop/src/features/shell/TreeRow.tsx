import type { ReactNode } from "react";
import { ChevronRightIcon } from "@/components/Icons";
import { cn } from "@/lib/cn";

interface TreeRowProps {
  label: string;
  /** Shown before the label: a folder mark for something at the top level. */
  leading?: ReactNode;
  /** Draws the label heavier, for a row at the top level of the tree. */
  strong?: boolean;
  expanded: boolean;
  onToggle: () => void;
  selected: boolean;
  onSelect: () => void;
  /** Shown at the right edge: a status word, an activity indicator. */
  trailing?: ReactNode;
}

/**
 * A row that has rows nested under it. It is two buttons side by side: the
 * name selects the row, and the arrow opens and closes what is beneath
 * without selecting anything. Whether selecting also opens the row is up to
 * the caller.
 */
export function TreeRow({ label, leading, strong = false, expanded, onToggle, selected, onSelect, trailing }: TreeRowProps) {
  return (
    <div
      className={cn(
        "flex items-center rounded-row transition-colors duration-[120ms]",
        selected ? "bg-selection" : "hover:bg-hover",
      )}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
        onClick={onToggle}
        className="flex cursor-pointer items-center self-stretch pl-[5px] pr-1 text-dim transition-[color,scale] duration-100 hover:text-bright active:scale-75"
      >
        <ChevronRightIcon
          size={12}
          className={cn("transition-transform duration-150 ease-settle", expanded && "rotate-90")}
        />
      </button>

      <button
        type="button"
        aria-current={selected ? "page" : undefined}
        onClick={onSelect}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 py-1 pr-[7px] text-left"
      >
        {leading}
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-bright",
            strong ? "text-name font-semibold tracking-[0.15px]" : "text-ui",
          )}
        >
          {label}
        </span>
        {trailing}
      </button>
    </div>
  );
}

/** The rows nested under a TreeRow, on Conduit's indent guide. */
export function TreeChildren({ children }: { children: ReactNode }) {
  return <ul className="ml-[11px] animate-rise-in border-l border-line pl-1">{children}</ul>;
}
