import { PERSONA_MAX_LENGTH, type Persona, type Project } from "@rooms/shared";
import type { Ledger } from "../ledger/ledger";
import type { Db } from "../store/db";
import { accessFor } from "./access";
import type { Briefs } from "./briefs";
import { hiredPersonaPrompt, personaPrompt, personaSystemPrompt } from "./prompts";
import { collectText, NO_ACCESS, type LeadRuntime } from "./runtime";

/**
 * Personas: getting one written, once, for each project agent.
 *
 * A persona is drafted by the lead itself from its brief, since the lead is
 * the one that knows the project or the product. You can then edit it. If
 * there is no brief yet, that is written first.
 */
export interface Personas {
  /** Returns the persona, having the lead write one first if there is none. */
  ensure(project: Project): Promise<Persona>;
  /** Starts writing a missing persona in the background. Safe to call often. */
  prepare(project: Project): void;
  isWriting(projectId: string): boolean;
}

/** Writing a persona is mostly rewording the brief, with a few reads to fill a gap. */
const PERSONA_LIMITS = { effort: "quick", firstTextTimeoutMs: null } as const;
const PERSONA_READS = 6;

interface Deps {
  db: Db;
  ledger: Ledger;
  runtime: LeadRuntime;
  briefs: Briefs;
  /** The instructions you gave a hired agent, which is what its persona is written from. */
  instructionsOf: (projectId: string) => string | null;
}

export function createPersonas({ db, ledger, runtime, briefs, instructionsOf }: Deps): Personas {
  /** One in-flight write per project, so two callers never start two. */
  const writing = new Map<string, Promise<Persona>>();

  /** A lead's persona comes from its brief, a hired agent's from the instructions you gave it. */
  async function draft(project: Project) {
    const brief = await briefs.ensure(project);

    if (!brief) {
      return runtime.wake({
        project,
        reason: "refresh_brief",
        systemPrompt: personaSystemPrompt(project),
        prompt: hiredPersonaPrompt(project, instructionsOf(project.id) ?? project.displayName),
        access: NO_ACCESS,
        limits: PERSONA_LIMITS,
      });
    }

    return runtime.wake({
      project,
      reason: "refresh_brief",
      systemPrompt: personaSystemPrompt(project),
      prompt: personaPrompt(project, brief),
      access: accessFor(db, project, PERSONA_READS),
      limits: PERSONA_LIMITS,
    });
  }

  async function write(project: Project): Promise<Persona> {
    const wake = await draft(project);

    const body = (await collectText(wake)).trim().slice(0, PERSONA_MAX_LENGTH);
    if (!body) throw new Error("The lead returned an empty persona.");

    return ledger.writePersona(project.id, body, "lead");
  }

  function ensure(project: Project): Promise<Persona> {
    const existing = ledger.readPersona(project.id);
    if (existing) return Promise.resolve(existing);

    let inFlight = writing.get(project.id);
    if (!inFlight) {
      inFlight = write(project).finally(() => writing.delete(project.id));
      writing.set(project.id, inFlight);
    }
    return inFlight;
  }

  return {
    ensure,
    prepare(project) {
      ensure(project).catch((error) =>
        console.error(`[sidecar] could not write a persona for ${project.handle}:`, error),
      );
    },
    isWriting: (projectId) => writing.has(projectId),
  };
}
