import type { Brief, Persona } from "@rooms/shared";

/**
 * The project ledger: a project's durable record, and the only memory a lead
 * has (principle P3). All ledger access goes through this interface, so the
 * storage behind it can change without touching leads or routes.
 *
 * It holds briefs and personas today. Interests, decisions, handoffs and
 * notes join in M4 and M5, as listed in specs/10-data-model.md.
 */
export interface Ledger {
  /** The latest brief, or null if the project has never had one. */
  readBrief(projectId: string): Brief | null;
  /** Stores a new version. Throws BriefTooLongError past the hard cap (R-LEAD-03). */
  writeBrief(projectId: string, body: string, writtenBy: Brief["writtenBy"]): Brief;

  /** The latest persona, or null if none has been written. */
  readPersona(projectId: string): Persona | null;
  /** Stores a new version. The caller keeps it within PERSONA_MAX_LENGTH. */
  writePersona(projectId: string, body: string, writtenBy: Persona["writtenBy"]): Persona;
}

/**
 * The spec caps a brief at 4,000 tokens. Counting tokens needs a model call,
 * so the cap is enforced in characters at roughly four per token.
 */
export const BRIEF_MAX_CHARS = 16_000;

export class BriefTooLongError extends Error {
  constructor(readonly length: number) {
    super(`Brief is ${length} characters. The limit is ${BRIEF_MAX_CHARS}.`);
    this.name = "BriefTooLongError";
  }
}
