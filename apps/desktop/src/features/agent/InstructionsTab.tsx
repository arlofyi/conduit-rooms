import { Textarea } from "@headlessui/react";
import { AGENT_INSTRUCTIONS_MAX_LENGTH, type Project } from "@rooms/shared";
import { useState } from "react";
import { useDismissAgent, useSaveInstructions } from "@/api/mutations";
import { useAgent } from "@/api/queries";
import { Button, Notice } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatFull } from "@/lib/time";
import { TabSkeleton } from "./BriefTab";

interface InstructionsTabProps {
  agent: Project;
  /** Called after the agent has been let go, so the drawer can close. */
  onDismissed: () => void;
}

/**
 * A hired agent's instructions: who it is and how it should work, as you
 * wrote them. It reads them every time it is woken. This is also where you
 * let the agent go.
 */
export function InstructionsTab({ agent, onDismissed }: InstructionsTabProps) {
  const { data, error, isLoading, mutate } = useAgent(agent.id);
  const [editing, setEditing] = useState(false);

  if (isLoading) return <TabSkeleton />;

  if (error || !data) {
    return (
      <Notice tone="error" actions={<Button onClick={() => void mutate()}>Try again</Button>}>
        The instructions could not be loaded.
      </Notice>
    );
  }

  if (editing) {
    return <InstructionsEditor agent={agent} current={data.hired.instructions} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-badge text-dim">Hired {formatFull(data.hired.hiredAt)}</p>
        <Button onClick={() => setEditing(true)}>Edit</Button>
      </div>

      <p className="select-text whitespace-pre-wrap text-body leading-[1.6] text-bright">{data.hired.instructions}</p>

      <p className="text-note leading-normal text-dim">
        {agent.displayName} belongs to no project. It knows every project through that project's brief, can search
        the web, and cannot open files or change anything.
      </p>

      <DismissAgent agent={agent} onDismissed={onDismissed} />
    </div>
  );
}

function InstructionsEditor({ agent, current, onDone }: { agent: Project; current: string; onDone: () => void }) {
  const [text, setText] = useState(current);
  const { trigger: save, isMutating: isSaving, error, reset } = useSaveInstructions(agent.id);

  const trimmed = text.trim();
  const canSave = trimmed.length > 0 && trimmed !== current && !isSaving;

  async function submit() {
    if (!canSave) return;
    try {
      await save(trimmed);
      onDone();
    } catch {
      // The reason is on screen under the box, and the text is still in it.
    }
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Textarea
        autoFocus
        value={text}
        rows={16}
        maxLength={AGENT_INSTRUCTIONS_MAX_LENGTH}
        aria-label={`Instructions of ${agent.displayName}`}
        aria-invalid={error ? true : undefined}
        onChange={(event) => {
          setText(event.target.value);
          if (error) reset();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void submit();
        }}
        className={cn(
          "w-full resize-y rounded-control border bg-panel px-2.5 py-2 text-title leading-[1.55] text-bright outline-none",
          "transition-colors duration-[120ms] focus:border-accent",
          error ? "border-bad/60" : "border-line",
        )}
      />

      <div className="flex items-center gap-2">
        <span className="text-label tabular-nums text-dim">
          {text.length} / {AGENT_INSTRUCTIONS_MAX_LENGTH}
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={!canSave} loading={isSaving}>
            Save
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="select-text text-note text-bad">
          The instructions were not saved. {error.message}
        </p>
      )}
    </form>
  );
}

/** Letting an agent go takes two clicks, because it cannot be undone from here. */
function DismissAgent({ agent, onDismissed }: { agent: Project; onDismissed: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const { trigger: dismiss, isMutating, error } = useDismissAgent(agent.id);

  async function letGo() {
    try {
      await dismiss();
      onDismissed();
    } catch {
      // The reason is shown below.
    }
  }

  return (
    <section className="mt-2 flex flex-col gap-2 border-t border-line pt-4">
      {confirming ? (
        <Notice
          tone="warn"
          actions={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Keep
              </Button>
              <Button variant="danger" loading={isMutating} onClick={() => void letGo()}>
                Let go
              </Button>
            </>
          }
        >
          {agent.displayName} leaves the sidebar and every room. What it said stays.
        </Notice>
      ) : (
        <Button variant="danger" className="self-start" onClick={() => setConfirming(true)}>
          Let {agent.displayName} go
        </Button>
      )}

      {error && (
        <p role="alert" className="text-note text-bad">
          {error.message}
        </p>
      )}
    </section>
  );
}
