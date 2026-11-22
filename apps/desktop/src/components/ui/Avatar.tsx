import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

interface AvatarProps {
  /** The first letter is shown. */
  name: string;
  /** The project's color from Conduit. Omit for the neutral avatar used for you. */
  color?: string;
  size?: number;
  className?: string;
}

/**
 * A letter on a tint of the project's color (R-UI-20). Conduit has no project
 * icons, only colors, so the tint is what makes a lead recognisable at a glance.
 */
export function Avatar({ name, color, size = 28, className }: AvatarProps) {
  const style: CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.43),
    ...(color && {
      color,
      background: `color-mix(in srgb, ${color} 18%, transparent)`,
      borderColor: `color-mix(in srgb, ${color} 34%, transparent)`,
    }),
  };

  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[28%] border font-semibold uppercase leading-none",
        !color && "border-line bg-selection text-mid",
        className,
      )}
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );
}
