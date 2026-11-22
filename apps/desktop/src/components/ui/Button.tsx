import { Button as HeadlessButton, type ButtonProps as HeadlessButtonProps } from "@headlessui/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

type Variant = "secondary" | "primary" | "ghost" | "danger";
type Size = "sm" | "md";

export interface ButtonProps extends Omit<HeadlessButtonProps, "className" | "children"> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and blocks clicks while work is in flight. */
  loading?: boolean;
  className?: string;
  children: ReactNode;
}

// Measurements follow Conduit's .ui-btn: 12px text, 26px or 30px tall, 6px radius.
const BASE =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-control border " +
  // Colors ease on hover, and the button gives a little under a press.
  "leading-none transition-[color,background-color,border-color,scale] duration-[120ms] ease-out " +
  "not-data-disabled:active:scale-[0.97] " +
  "data-disabled:opacity-45 not-data-disabled:cursor-pointer";

const SIZES: Record<Size, string> = {
  sm: "h-[26px] px-2.5 text-ui",
  md: "h-[30px] px-3.5 text-name",
};

const VARIANTS: Record<Variant, string> = {
  secondary:
    "border-line bg-sidebar text-bright not-data-disabled:data-hover:border-accent-edge not-data-disabled:data-hover:bg-accent-wash",
  primary:
    "border-accent bg-accent font-medium text-panel not-data-disabled:data-hover:bg-accent-hover",
  ghost:
    "border-transparent bg-transparent text-mid not-data-disabled:data-hover:bg-selection not-data-disabled:data-hover:text-bright",
  danger:
    "border-transparent bg-transparent text-bad not-data-disabled:data-hover:border-bad/35 not-data-disabled:data-hover:bg-bad/12",
};

/** The one button. Every clickable label in the app is this. */
export function Button({
  variant = "secondary",
  size = "sm",
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <HeadlessButton
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, SIZES[size], VARIANTS[variant], className)}
      {...rest}
    >
      {loading && <Spinner size={12} />}
      {children}
    </HeadlessButton>
  );
}
