import type { Project } from "@rooms/shared";
import { clip, describeMember, unavailableDecision, type Gate, type GateQuestion } from "./gate";

/**
 * The gate, answered by a local model served by Ollama. Used when there is
 * no Jev key, so the room still works with nothing leaving the machine.
 *
 * It asks the same thing Jev is asked (gate.ts): who, of everyone in the
 * room, is this message for. A general chat model is slower at it and less
 * sure than a classifier, so Jev is preferred when available.
 */

/**
 * Chosen by measurement on 2026-11-21: of the local models on this machine,
 * qwen3:8b classified best. Change it with ROOMS_GATE_MODEL.
 */
export const DEFAULT_GATE_MODEL = "qwen3:8b";

/** The first call after a while loads the model into memory, so this is generous. */
const TIMEOUT_MS = 8_000;

const EVERYONE = "everyone";
const NOBODY = "nobody";

const INSTRUCTIONS = `A person wrote a message in a chat room shared by the leads of several software projects. They named nobody. Decide who the message is for.

Answer with exactly one of the options you are given:
- a project's handle, when the message asks about something that project owns or does
- "${EVERYONE}", when the message speaks to the whole group at once ("everyone", "team", "anyone")
- "${NOBODY}", when the message is thanks, small talk, an announcement or thinking out loud

Reply with JSON only.`;

interface OllamaGateOptions {
  /** Where Ollama listens, for example http://127.0.0.1:11434. */
  url: string;
  model: string;
}

export function createOllamaGate({ url, model }: OllamaGateOptions): Gate {
  return {
    async decide(question) {
      const startedAt = Date.now();
      const elapsed = () => Date.now() - startedAt;
      const handles = question.members.map((member) => member.project.handle);

      try {
        const response = await fetch(`${url}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: AbortSignal.timeout(TIMEOUT_MS),
          body: JSON.stringify({
            model,
            stream: false,
            // Constrains the answer to one of the options, so there is no prose to parse around.
            format: answerSchema(handles),
            think: false,
            keep_alive: "30m",
            options: { temperature: 0, num_predict: 60 },
            messages: [
              { role: "system", content: INSTRUCTIONS },
              { role: "user", content: describe(question) },
            ],
          }),
        });

        if (!response.ok) return unavailableDecision(`Ollama answered ${response.status}`, elapsed());

        const body = (await response.json()) as { message?: { content?: string } };
        const { who } = JSON.parse(body.message?.content ?? "{}") as { who?: string };

        const speakers = speakersFor(who, question);
        if (!speakers) return unavailableDecision("The local model answered outside its options", elapsed());

        return { speakers, reason: `${model} chose ${who}`, latencyMs: elapsed(), unavailable: false };
      } catch (error) {
        return unavailableDecision(error instanceof Error ? error.message : String(error), elapsed());
      }
    },
  };
}

function answerSchema(handles: string[]) {
  return {
    type: "object",
    properties: { who: { type: "string", enum: [...handles, EVERYONE, NOBODY] } },
    required: ["who"],
  };
}

function speakersFor(who: string | undefined, question: GateQuestion): Project[] | null {
  if (who === EVERYONE) return question.members.map((member) => member.project);
  if (who === NOBODY) return [];

  const chosen = question.members.find((member) => member.project.handle === who);
  return chosen ? [chosen.project] : null;
}

function describe(question: GateQuestion): string {
  const options = question.members
    .map((member) => `${member.project.handle}: ${clip(describeMember(member), 900)}`)
    .join("\n\n");

  return `The projects in the room:\n\n${options}\n\nThe message:\n${clip(question.message)}\n\nWho is it for?`;
}
