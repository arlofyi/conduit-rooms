import { Textarea } from "@headlessui/react";
import { PERSONA_MAX_LENGTH, type Persona, type Project } from "@rooms/shared";
import { useMemo, useState } from "react";
import { useSavePersona } from "@/api/mutations";
import { usePersona } from "@/api/queries";
import { Button, Notice, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatFull } from "@/lib/time";
import { TabSkeleton } from "./BriefTab";
import { parsePersona } from "./personaParts";

/**
 * A project agent's persona: what it is and what to ask it about. This is
 * what the gate reads to decide whether a message with no tag and no name is
 * for this agent, so editing it changes who answers in a room.
 */
export function PersonaTab({ project }: { project: Project }) {
  const { data, error, isLoading, mutate } = usePersona(project.id);
  const [editing, setEditing] = useState(false);

  if (isLoading) return <TabSkeleton />;

  if (error && !data) {
    return (
      <Notice tone="error" actions={<Button onClick={() => void mutate()}>Try again</Button>}>
        The persona could not be loaded.
      </Notice>
    );
  }

  const persona = data?.persona ?? null;

  if (editing) {
    return <PersonaEditor project={project} persona={persona} onDone={() => setEditing(false)} />;
  }

  if (!persona) {
    return data?.writing ? (
      <p role="status" className="flex items-center gap-2 text-title text-mid">
        <Spinner size={12} />
        {project.displayName} is writing its persona. This takes a minute.
      </p>
    ) : (
      <div className="flex flex-col items-start gap-3">
        <p className="select-text text-title leading-normal text-mid">
          {project.displayName} has no persona yet, so a message that does not name it will not reach it.
        </p>
        <Button onClick={() => setEditing(true)}>Write one</Button>
      </div>
    );
  }

  return <PersonaView persona={persona} onEdit={() => setEditing(true)} />;
}

function PersonaView({ persona, onEdit }: { persona: Persona; onEdit: () => void }) {
  const parts = useMemo(() => parsePersona(persona.body), [persona.body]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-badge text-dim">
          Version {persona.version}, written by {persona.writtenBy === "user" ? "you" : "the lead"},{" "}
          {formatFull(persona.writtenAt)}
        </p>
        <Button onClick={onEdit}>Edit</Button>
      </div>

      {parts ? (
        <>
          <p className="select-text text-body leading-[1.6] text-bright">{parts.summary}</p>
          <TopicList title="Ask me about" topics={parts.askAbout} tone="accent" />
          {parts.notMine.length > 0 && <TopicList title="Not mine" topics={parts.notMine} tone="muted" />}
        </>
      ) : (
        <p className="select-text whitespace-pre-wrap text-body leading-[1.6] text-bright">{persona.body}</p>
      )}

      <p className="text-note leading-normal text-dim">
        A message in a room that tags nobody is matched against every member's persona. The closer a topic here is
        to how you would phrase the question, the more reliably this agent answers it.
      </p>
    </div>
  );
}

const TOPIC_TONE = {
  accent: "border-accent-line/60 bg-accent-soft text-accent",
  muted: "border-line text-mid",
};

function TopicList({ title, topics, tone }: { title: string; topics: string[]; tone: keyof typeof TOPIC_TONE }) {
  return (
    <section>
      <h3 className="mb-1.5 text-ui font-semibold text-bright">
        {title} <span className="font-normal text-dim">{topics.length}</span>
      </h3>
      <ul className="flex flex-wrap gap-1.5">
        {topics.map((topic) => (
          <li
            key={topic}
            className={cn("select-text rounded-full border px-2 py-0.5 text-note leading-normal", TOPIC_TONE[tone])}
          >
            {topic}
          </li>
        ))}
      </ul>
    </section>
  );
}

interface PersonaEditorProps {
  project: Project;
  persona: Persona | null;
  onDone: () => void;
}

/** Edits the persona as the plain text it is. Saving stores a new version. Older ones are kept. */
function PersonaEditor({ project, persona, onDone }: PersonaEditorProps) {
  const [text, setText] = useState(persona?.body ?? starterFor(project));
  const { trigger: save, isMutating: isSaving, error, reset } = useSavePersona(project.id);

  const trimmed = text.trim();
  const unchanged = trimmed === (persona?.body ?? "");
  const canSave = trimmed.length > 0 && !unchanged && !isSaving;

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
        rows={14}
        maxLength={PERSONA_MAX_LENGTH}
        aria-label={`Persona of ${project.displayName}`}
        aria-invalid={error ? true : undefined}
        onChange={(event) => {
          setText(event.target.value);
          if (error) reset();
        }}
        // Cmd+Enter saves, as it does in most editors. Plain Enter is a new line.
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
        <span
          className={cn(
            "text-label tabular-nums",
            text.length > PERSONA_MAX_LENGTH * 0.9 ? "text-warn" : "text-dim",
          )}
        >
          {text.length} / {PERSONA_MAX_LENGTH}
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
          The persona was not saved. {error.message}
        </p>
      )}

      <p className="text-note leading-normal text-dim">
        Keep the three lines if you can: one sentence, then "Ask me about:" and "Not mine:" with topics separated by
        commas. Write topics the way you would ask about them.
      </p>
    </form>
  );
}

/** A blank persona in the usual shape, for an agent that has none. */
function starterFor(project: Project): string {
  return `${project.displayName} is \nAsk me about: \nNot mine: `;
}
