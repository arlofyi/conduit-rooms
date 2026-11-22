import { PERSONA_MAX_LENGTH, type Project } from "@rooms/shared";
import {
  DRAFT_INSTRUCTIONS_HEADING,
  DRAFT_PERSONA_HEADING,
  draftAgentPrompt,
  draftAgentSystemPrompt,
} from "./prompts";
import { collectText, NO_ACCESS, type LeadRuntime } from "./runtime";

export interface AgentDraft {
  instructions: string;
  persona: string;
}

/** Nobody is hired yet, so the draft is written by a stand-in with no tools at all. */
const DRAFTER: Project = {
  id: "drafter",
  kind: "hired",
  handle: "drafter",
  displayName: "Drafter",
  repoPath: null,
  productId: null,
  color: "",
};

/**
 * Drafts a new agent's instructions and persona from its name and what you
 * want it for. You edit both before hiring, so nothing here is stored.
 */
export async function draftAgent(runtime: LeadRuntime, name: string, briefing: string): Promise<AgentDraft> {
  const wake = runtime.wake({
    project: DRAFTER,
    reason: "refresh_brief",
    systemPrompt: draftAgentSystemPrompt(),
    prompt: draftAgentPrompt(name, briefing),
    // Writing two short documents needs no lookups.
    access: NO_ACCESS,
    limits: { effort: "quick", firstTextTimeoutMs: 45_000 },
  });

  return parseDraft(await collectText(wake));
}

/** Splits the reply at its two headings. Exported for tests. */
export function parseDraft(text: string): AgentDraft {
  const instructionsAt = text.indexOf(DRAFT_INSTRUCTIONS_HEADING);
  const personaAt = text.indexOf(DRAFT_PERSONA_HEADING);

  if (instructionsAt === -1 || personaAt === -1 || personaAt < instructionsAt) {
    throw new Error("The draft did not come back in the expected shape.");
  }

  return {
    instructions: text.slice(instructionsAt + DRAFT_INSTRUCTIONS_HEADING.length, personaAt).trim(),
    persona: text
      .slice(personaAt + DRAFT_PERSONA_HEADING.length)
      .trim()
      .slice(0, PERSONA_MAX_LENGTH),
  };
}
