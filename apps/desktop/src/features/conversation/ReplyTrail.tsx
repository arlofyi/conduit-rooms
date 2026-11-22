import { describeStep, REPLY_LOOKUPS, summariseSteps, type Message, type ReplyStep } from "@rooms/shared";
import { useState } from "react";
import { useLiveText } from "@/api/liveText";
import { ChevronRightIcon } from "@/components/Icons";
import { CheckIcon } from "@/components/RoomsIcons";
import { StopIcon } from "@/components/RoomsIcons";
import { Button, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";

interface ReplyTrailProps {
  message: Message;
  /** What to say of a finished reply that looked nothing up: "Answered from its brief". */
  unaidedLabel: string;
  onStop: () => void;
}

/**
 * How a lead's reply came about.
 *
 * Before it has written anything, its steps stack up as they happen: what it
 * has read, and what it is reading now. Once it starts writing they fold into
 * one line, which stays on the finished reply and opens again on a click. A
 * reply that looked nothing up says so, since that is worth knowing too.
 */
export function ReplyTrail({ message, unaidedLabel, onStop }: ReplyTrailProps) {
  const text = useLiveText(message.id, message.body);
  const steps = message.steps;

  // Your own messages, system rows, and replies from before steps were kept.
  if (message.authorKind !== "lead" || (steps === null && message.status !== "streaming")) return null;

  const taken = steps ?? [];
  if (message.status === "streaming" && text.length === 0) return <LiveSteps steps={taken} onStop={onStop} />;

  return <FoldedSteps steps={taken} message={message} unaidedLabel={unaidedLabel} />;
}

/** The steps so far, with the latest one marked as going on. "Thinking" stands in until there is a first. */
function LiveSteps({ steps, onStop }: { steps: readonly ReplyStep[]; onStop: () => void }) {
  const finished = steps.slice(0, -1);
  const current = steps.at(-1);

  return (
    <ol role="status" className="mt-0.5 flex flex-col gap-0.5 text-ui">
      {finished.map((step, index) => (
        <StepLine key={index} step={step} />
      ))}
      <li className="flex min-w-0 animate-rise-in items-center gap-2 text-mid">
        <span className="flex w-3 shrink-0 justify-center">
          <Spinner size={11} />
        </span>
        <span className="truncate">{current ? describeStep(current, "doing") : "Thinking"}</span>
        <StopButton onStop={onStop} />
      </li>
    </ol>
  );
}

function StepLine({ step }: { step: ReplyStep }) {
  return (
    <li className="flex min-w-0 animate-rise-in items-center gap-2 text-mid">
      <span className="flex w-3 shrink-0 justify-center text-good">
        <CheckIcon size={10} className="animate-pop-in" />
      </span>
      <span className="truncate">{describeStep(step, "done")}</span>
    </li>
  );
}

/** Ends the reply where it is. What has been written so far is kept. */
export function StopButton({ onStop }: { onStop: () => void }) {
  return (
    <Button variant="ghost" onClick={onStop} className="h-[20px] shrink-0 gap-1 px-1.5 text-label text-dim hover:text-bright">
      <StopIcon size={9} />
      Stop
    </Button>
  );
}

interface FoldedStepsProps extends Omit<ReplyTrailProps, "onStop"> {
  steps: readonly ReplyStep[];
}

function FoldedSteps({ steps, message, unaidedLabel }: FoldedStepsProps) {
  const [open, setOpen] = useState(false);
  const summary = summariseSteps(steps);
  const took = message.status === "streaming" || message.tookMs === null ? null : formatTook(message.tookMs);

  // Nothing was looked up. Say so once the reply is in, and say nothing while it is still being written.
  if (!summary) {
    if (message.status !== "complete") return null;
    return <p className="mb-1 text-label text-dim">{[unaidedLabel, took].filter(Boolean).join(" · ")}</p>;
  }

  const spent = steps.length >= REPLY_LOOKUPS;

  return (
    <div className="mb-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex max-w-full cursor-pointer items-center gap-1 rounded-row border border-line py-px pl-1 pr-2 text-label text-mid transition-[color,border-color,scale] duration-[120ms] hover:border-accent-line hover:text-bright active:scale-[0.97]"
      >
        <ChevronRightIcon size={11} className={cn("shrink-0 transition-transform duration-150 ease-settle", open && "rotate-90")} />
        <span className="truncate">{summary}</span>
        {spent && <span className="shrink-0 text-warn">· used all {REPLY_LOOKUPS} lookups</span>}
        {took && <span className="shrink-0 text-dim">· {took}</span>}
      </button>

      {open && (
        <ol className="mt-1 flex flex-col gap-0.5 text-ui">
          {steps.map((step, index) => (
            <StepLine key={index} step={step} />
          ))}
        </ol>
      )}
    </div>
  );
}

/** "14s" under a minute, "1m 20s" over. */
function formatTook(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
