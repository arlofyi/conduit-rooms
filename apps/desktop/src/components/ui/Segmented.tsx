import { Radio, RadioGroup } from "@headlessui/react";
import type { ReactNode } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

interface SegmentedProps<T extends string> {
  /** Names the choice for screen readers: "View", "Scope". */
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}

/** A one-of-N picker (Conduit's .ui-seg): one track, the chosen segment raised inside it. */
export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onChange={onChange}
      className="inline-flex shrink-0 gap-0.5 self-start rounded-[7px] border border-line bg-panel p-0.5"
    >
      {options.map((option) => (
        <Radio
          key={option.value}
          value={option.value}
          className="inline-flex h-[22px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-row px-2.5 text-ui text-mid transition-[color,background-color,box-shadow,scale] duration-[120ms] ease-out active:scale-[0.97] data-checked:bg-selection data-checked:text-bright data-checked:shadow-[inset_0_0_0_1px_var(--accent-edge)] not-data-checked:data-hover:bg-hover not-data-checked:data-hover:text-bright"
        >
          {option.label}
        </Radio>
      ))}
    </RadioGroup>
  );
}
