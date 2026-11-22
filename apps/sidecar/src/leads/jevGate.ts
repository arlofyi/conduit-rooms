import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import type { Project } from "@rooms/shared";
import {
  clip,
  describeMember,
  unavailableDecision,
  type Gate,
  type GateDecision,
  type GateMember,
  type GateQuestion,
} from "./gate";

/**
 * The gate, answered by Jev: TypeSafe's classifier model. Unlike a chat
 * model asked to output a label, Jev is built for this. It takes a `state`
 * (the facts) and `choice` questions (each option with a description of what
 * it means) and returns how likely each option is.
 *
 * One call per message asks three questions:
 *
 *   group     is this addressed to a whole group?            yes / no
 *   followUp  does it carry on from what was just said?      yes / no
 *   who       which of these is it for?                      each member, or nobody
 *
 * Each member is an option of `who`, described by its persona. That is the
 * comparison the gate depends on (see gate.ts).
 *
 * Measured on 2026-11-21 against the real #projects room: 22 of 22 untagged
 * messages routed correctly, at a median of 0.3 seconds. Conduit Code uses
 * Jev the same way (conduit-code src/providers/native/jev.ts). Calls go to
 * api.typesafe.ai.
 */

const PROVIDER = "typesafe";
const MODEL = "jev-latest";

const TIMEOUT_MS = 6_000;

/** The option that means "no lead should reply". Not a legal project handle, so it cannot collide with one. */
const NOBODY = "nobody_";

const GROUP_QUESTION = {
  type: "choice" as const,
  instructions: "Is userPrompt addressed to a whole group of people at once?",
  criteria: {
    yes: 'It speaks to a group: "everyone", "all of you", "team", "anyone", "who can".',
    no: "It speaks to one party, or to nobody in particular.",
  },
};

const FOLLOW_UP_QUESTION = {
  type: "choice" as const,
  instructions:
    "previousMessage was just said to the person who wrote userPrompt. Is userPrompt a reply to it, or a further question to whoever said it?",
  criteria: {
    yes: 'It answers previousMessage or keeps the same thread going: "and then?", "why?", "ok, do that", "how long will it take?".',
    no: "It starts a different topic, or it is thanks, a greeting or small talk that asks for nothing.",
  },
};

const WHO_INSTRUCTIONS =
  "A person wrote userPrompt in a chat room shared by the leads of several software projects, without naming anyone. Who is it for?";

const NOBODY_MEANS =
  "The message is thanks, small talk, an announcement or thinking out loud. It asks nothing about any project.";

interface ChoiceAnswer {
  type?: string;
  probabilities?: Record<string, number>;
}

export function createJevGate(apiKey: string): Gate {
  return {
    async decide(question) {
      const startedAt = Date.now();
      const elapsed = () => Date.now() - startedAt;

      const models = builtinModels();
      const model = models.getModelOfType("classifier", PROVIDER, MODEL);
      if (!model) return unavailableDecision(`${PROVIDER}/${MODEL} is not in pi-ai's catalog`, elapsed());

      const lastSpeaker = leadWhoJustSpoke(question);

      // classify() does not reject. Provider errors come back as a stop reason.
      const result = await models.classify(
        model,
        {
          state: {
            userPrompt: clip(question.message, 2_000),
            previousMessage: lastSpeaker ? clip(lastSpeaker.said, 300) : "(nothing)",
          },
          questions: {
            group: GROUP_QUESTION,
            followUp: FOLLOW_UP_QUESTION,
            who: { type: "choice", instructions: WHO_INSTRUCTIONS, criteria: whoOptions(question.members) },
          },
        },
        { apiKey, signal: AbortSignal.timeout(TIMEOUT_MS) },
      );

      if (result.stopReason !== "stop") {
        return unavailableDecision(result.errorMessage ?? result.stopReason, elapsed());
      }

      const group = (result.answers.group as ChoiceAnswer | undefined)?.probabilities;
      const followUp = (result.answers.followUp as ChoiceAnswer | undefined)?.probabilities;
      const who = (result.answers.who as ChoiceAnswer | undefined)?.probabilities;
      if (!group || !followUp || !who) return unavailableDecision("Jev answered in an unexpected shape", elapsed());

      const decision = pick(question.members, who, {
        group: group.yes ?? 0,
        followUp: followUp.yes ?? 0,
        lastSpeaker: lastSpeaker?.project ?? null,
      });
      return { ...decision, latencyMs: elapsed(), unavailable: false };
    },
  };
}

function whoOptions(members: readonly GateMember[]): Record<string, string> {
  return {
    ...Object.fromEntries(members.map((member) => [member.project.handle, describeMember(member)])),
    [NOBODY]: NOBODY_MEANS,
  };
}

/** The lead whose reply is the last thing said in the room, if the last thing said was a lead's reply. */
function leadWhoJustSpoke(question: GateQuestion): { project: Project; said: string } | null {
  const last = question.recent.findLast((message) => message.authorKind !== "system" && message.body.trim());
  if (last?.authorKind !== "lead") return null;

  const member = question.members.find(({ project }) => project.id === last.authorProjectId);
  return member ? { project: member.project, said: last.body } : null;
}

interface Signals {
  /** How likely the message is addressed to a whole group. */
  group: number;
  /** How likely the message carries on from what was just said. */
  followUp: number;
  /** The lead who just spoke, if a lead's reply is the last thing in the room. */
  lastSpeaker: Project | null;
}

/**
 * Turns Jev's probabilities into who replies. Exported for tests.
 *
 *   for the group          every lead replies
 *   about one lead's work  that lead replies, whoever spoke last
 *   a follow-up            the lead who just spoke replies, unless it asks for nothing ("nice")
 *   none of those          nobody does
 *
 * Subject wins over thread: "and how are mentions parsed?" right after
 * Conduit spoke is still a question for the lead that owns mentions.
 */
export function pick(
  members: readonly GateMember[],
  who: Readonly<Record<string, number>>,
  { group, followUp, lastSpeaker }: Signals,
): Pick<GateDecision, "speakers" | "reason"> {
  const percent = (probability: number) => `${Math.round(probability * 100)}%`;
  const nobody = who[NOBODY] ?? 0;
  const scores = members
    .map(({ project }) => ({ project, score: who[project.handle] ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const summary = [
    ...scores.map(({ project, score }) => `${project.handle} ${percent(score)}`),
    `nobody ${percent(nobody)}`,
    `follow-up ${percent(followUp)}`,
  ].join(", ");

  if (group >= 0.5) {
    return { speakers: members.map((member) => member.project), reason: `for everyone (${percent(group)})` };
  }

  const best = scores[0];
  if (best && best.score >= CLEARLY_ABOUT) {
    return { speakers: [best.project], reason: `about ${best.project.handle}: ${summary}` };
  }
  if (lastSpeaker && followUp >= 0.5 && nobody < PLAINLY_NOTHING) {
    return { speakers: [lastSpeaker], reason: `follow-up to ${lastSpeaker.handle}: ${summary}` };
  }
  if (best && best.score >= nobody) {
    return { speakers: [best.project], reason: `best fit ${best.project.handle}: ${summary}` };
  }
  return { speakers: [], reason: `for nobody: ${summary}` };
}

/** Above this, a message is plainly about one lead's project and goes to it even mid-thread with another. */
const CLEARLY_ABOUT = 0.6;

/**
 * Above this, a message plainly asks for nothing. "nice" right after a reply
 * does follow on from it, but it is not a question, and nobody should answer.
 */
const PLAINLY_NOTHING = 0.85;
