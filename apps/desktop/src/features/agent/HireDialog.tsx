import { Textarea } from "@headlessui/react";
import {
  AGENT_BRIEFING_MAX_LENGTH,
  AGENT_INSTRUCTIONS_MAX_LENGTH,
  AGENT_NAME_MAX_LENGTH,
  PERSONA_MAX_LENGTH,
  slugifyHandle,
  type Project,
} from "@rooms/shared";
import { useState, type FormEvent, type ReactNode } from "react";
import { useDraftAgent, useHireAgent } from "@/api/mutations";
import { Button, Modal, Notice, TextField } from "@/components/ui";
import { cn } from "@/lib/cn";

interface HireDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the new agent, after the dialog has closed. */
  onHired: (agent: Project) => void;
}

/**
 * Hiring an agent, in two steps:
 *
 *   1. describe   a name and what you want it for
 *   2. review     the instructions and persona drafted from that, which you edit, then hire
 *
 * Nothing exists until you press Hire. Closing the dialog throws the draft away.
 */
export function HireDialog({ open, onClose, onHired }: HireDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Hire an agent" wide>
      {/* Mounted only while open, so every hiring starts from a blank form. */}
      {open && <HireFlow onClose={onClose} onHired={onHired} />}
    </Modal>
  );
}

interface Documents {
  instructions: string;
  persona: string;
}

function HireFlow({ onClose, onHired }: Omit<HireDialogProps, "open">) {
  const [name, setName] = useState("");
  const [briefing, setBriefing] = useState("");
  /** Null on step one. Set once there is something to review. */
  const [documents, setDocuments] = useState<Documents | null>(null);

  const draft = useDraftAgent();
  const hire = useHireAgent();

  const hasName = name.trim().length >= 2;

  async function writeDraft(event: FormEvent) {
    event.preventDefault();
    if (!hasName || briefing.trim().length < 8 || draft.isMutating) return;

    try {
      setDocuments(await draft.trigger({ name: name.trim(), briefing: briefing.trim() }));
    } catch {
      // The reason is on screen, with the way round it: write the two documents yourself.
    }
  }

  async function submitHire(event: FormEvent) {
    event.preventDefault();
    if (!documents || hire.isMutating) return;

    try {
      const { agent } = await hire.trigger({ name: name.trim(), ...trimmed(documents) });
      onClose();
      onHired(agent);
    } catch {
      // The reason is on screen and everything you wrote is still in the form.
    }
  }

  if (!documents) {
    return (
      <form onSubmit={(event) => void writeDraft(event)} className="flex flex-col">
        <div className="flex flex-col gap-4 px-[22px] pb-1">
          <TextField
            label="Name"
            autoFocus
            value={name}
            maxLength={AGENT_NAME_MAX_LENGTH}
            placeholder="CTO"
            hint={hasName ? `You will tag it as @${slugifyHandle(name)}.` : "A role or a name. You tag it with this."}
            onChange={(event) => setName(event.target.value)}
          />

          <LongField
            label="What should it do?"
            value={briefing}
            rows={4}
            maxLength={AGENT_BRIEFING_MAX_LENGTH}
            placeholder="Challenges my architecture choices across all my projects. Blunt. Tells me when I am over-engineering."
            onChange={setBriefing}
          />

          {draft.error && (
            <Notice
              tone="warn"
              actions={<Button onClick={() => setDocuments({ instructions: "", persona: "" })}>Write it myself</Button>}
            >
              {draft.error.message}
            </Notice>
          )}

          <p className="text-note leading-normal text-dim">
            A hired agent belongs to no project. It knows every project through that project's brief, can search the
            web, and cannot open files or change anything.
          </p>
        </div>

        <DialogFooter>
          <Button size="md" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="md"
            variant="primary"
            type="submit"
            disabled={!hasName || briefing.trim().length < 8}
            loading={draft.isMutating}
          >
            {draft.isMutating ? "Drafting" : "Draft it"}
          </Button>
        </DialogFooter>
      </form>
    );
  }

  const ready = documents.instructions.trim().length > 0 && documents.persona.trim().length > 0;

  return (
    <form onSubmit={(event) => void submitHire(event)} className="flex min-h-0 flex-col">
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-[22px] pb-1">
        <LongField
          label="Instructions"
          hint="Who it is and how it should work. It reads this every time it is woken."
          value={documents.instructions}
          rows={9}
          maxLength={AGENT_INSTRUCTIONS_MAX_LENGTH}
          onChange={(instructions) => setDocuments({ ...documents, instructions })}
        />

        <LongField
          label="Persona"
          hint='What decides whether a message with no tag reaches it. One sentence, then "Ask me about:" and "Not mine:".'
          value={documents.persona}
          rows={6}
          maxLength={PERSONA_MAX_LENGTH}
          onChange={(persona) => setDocuments({ ...documents, persona })}
        />

        {hire.error && <Notice tone="error">{hire.error.message}</Notice>}
      </div>

      <DialogFooter>
        <Button size="md" variant="ghost" className="mr-auto" onClick={() => setDocuments(null)}>
          Back
        </Button>
        <Button size="md" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button size="md" variant="primary" type="submit" disabled={!ready} loading={hire.isMutating}>
          Hire {name.trim()}
        </Button>
      </DialogFooter>
    </form>
  );
}

function trimmed(documents: Documents): Documents {
  return { instructions: documents.instructions.trim(), persona: documents.persona.trim() };
}

function DialogFooter({ children }: { children: ReactNode }) {
  return <footer className="flex shrink-0 items-center justify-end gap-2 px-[22px] py-4">{children}</footer>;
}

interface LongFieldProps {
  label: string;
  hint?: string;
  value: string;
  rows: number;
  maxLength: number;
  placeholder?: string;
  onChange: (value: string) => void;
}

/** A labelled multi-line field with a character count that warns as the limit nears. */
function LongField({ label, hint, value, rows, maxLength, placeholder, onChange }: LongFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline text-ui font-medium text-bright">
        {label}
        <span
          className={cn(
            "ml-auto text-label font-normal tabular-nums",
            value.length > maxLength * 0.9 ? "text-warn" : "text-dim",
          )}
        >
          {value.length} / {maxLength}
        </span>
      </span>
      <Textarea
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-control border border-line bg-sidebar px-2.5 py-2 text-title leading-[1.55] text-bright outline-none transition-colors duration-[120ms] placeholder:text-dim hover:border-accent-line focus:border-accent"
      />
      {hint && <span className="text-note leading-normal text-mid">{hint}</span>}
    </label>
  );
}
