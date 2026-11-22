import { cn } from "@/lib/cn";
import type { MentionOption } from "./mentionQuery";

interface MentionMenuProps {
  id: string;
  options: MentionOption[];
  highlighted: number;
  onPick: (option: MentionOption) => void;
}

/**
 * The list that opens above the composer while you type "@". Focus stays in
 * the text box the whole time: the box owns the keys and points at the
 * highlighted row with aria-activedescendant, as a combobox does.
 */
export function MentionMenu({ id, options, highlighted, onPick }: MentionMenuProps) {
  return (
    <ul
      id={id}
      role="listbox"
      aria-label="Tag a project"
      className="absolute bottom-full left-0 z-20 mb-1.5 max-h-60 w-72 overflow-y-auto rounded-card border border-line bg-panel p-1 shadow-menu"
    >
      {options.map((option, index) => (
        <li
          key={option.handle}
          id={`${id}-${option.handle}`}
          role="option"
          aria-selected={index === highlighted}
          // mousedown, not click: a click would first take focus away from the text box.
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(option);
          }}
          className={cn(
            "flex cursor-pointer items-baseline gap-2 rounded-row px-2 py-[5px] text-ui",
            index === highlighted ? "bg-accent/16 text-bright" : "text-mid hover:bg-hover",
          )}
        >
          <span className="font-mono text-ui">@{option.handle}</span>
          <span className="min-w-0 truncate text-label text-dim">{option.label}</span>
        </li>
      ))}
    </ul>
  );
}
