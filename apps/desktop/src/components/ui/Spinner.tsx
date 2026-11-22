import { cn } from "@/lib/cn";

/** Conduit's slow spinner: a dashed circle turning once every 2.5 seconds. */
export function Spinner({ size = 13, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeDasharray="4 5"
      className={cn("shrink-0 animate-spin-slow text-accent", className)}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

/** Conduit's activity indicator: a small dot that breathes while something is happening. */
export function Pulse({ className }: { className?: string }) {
  return <span className={cn("size-2 shrink-0 animate-pulse-soft rounded-full bg-accent", className)} aria-hidden />;
}
