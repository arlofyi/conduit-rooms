import { Button as HeadlessButton, type ButtonProps as HeadlessButtonProps } from "@headlessui/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface IconButtonProps extends Omit<HeadlessButtonProps, "className" | "children" | "title"> {
  /** Names the action. Read by screen readers and shown as the tooltip. */
  label: string;
  className?: string;
  children: ReactNode;
}

/** A button that is only an icon. The label is required because the icon alone says nothing. */
export function IconButton({ label, className, children, ...rest }: IconButtonProps) {
  return (
    <HeadlessButton
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-row text-mid transition-[color,background-color,scale] duration-100",
        "data-disabled:opacity-45 not-data-disabled:cursor-pointer not-data-disabled:data-hover:bg-selection not-data-disabled:data-hover:text-bright not-data-disabled:active:scale-90",
        className,
      )}
      {...rest}
    >
      {children}
    </HeadlessButton>
  );
}
