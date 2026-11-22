import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "warn" | "error";

const TONES: Record<Tone, string> = {
  info: "border-line text-mid",
  warn: "border-warn/45 bg-warn/8 text-bright",
  error: "border-bad/50 bg-bad/9 text-bright",
};

interface NoticeProps {
  tone?: Tone;
  /** Buttons or links shown at the right edge. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** An inline notice: an error, a warning, or a neutral note. */
export function Notice({ tone = "info", actions, className, children }: NoticeProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex animate-rise-in select-text items-center gap-3 rounded-control border px-2.5 py-[7px] text-note leading-normal",
        TONES[tone],
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
