import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "muted" | "good" | "warn" | "bad";

const TONES: Record<Tone, string> = {
  neutral: "border-line text-mid",
  muted: "border-line/70 text-dim",
  accent: "border-accent/40 bg-accent/10 text-accent",
  good: "border-good/40 text-good",
  warn: "border-warn/40 text-warn",
  bad: "border-bad/40 text-bad",
};

/** A small status label: a phase, a state, where a value came from. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-[17px] shrink-0 items-center whitespace-nowrap rounded-full border px-[7px] text-badge leading-none",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
