import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/** A placeholder bar shown where content is about to load. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden
      style={style}
      className={cn("block animate-pulse-soft rounded-row bg-selection", className)}
    />
  );
}
