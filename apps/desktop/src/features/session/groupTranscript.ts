import type { TranscriptItem } from "@rooms/shared";

/**
 * Turns a session's flat list of items into what the page draws.
 *
 * Claude records one turn as many pieces: a sentence, six tool calls, another
 * sentence, three more calls. Drawn one per row, the tool calls bury the
 * conversation. So everything Claude does between two things you said becomes
 * one turn, and inside it each unbroken run of tool calls becomes one part
 * that can be folded away.
 */

export type TurnPart =
  | { kind: "text"; item: TranscriptItem }
  | { kind: "tools"; id: string; items: TranscriptItem[] };

export type TranscriptBlock =
  | { kind: "user"; item: TranscriptItem }
  | { kind: "note"; item: TranscriptItem }
  | { kind: "turn"; id: string; at: string | null; parts: TurnPart[] };

export function groupTranscript(items: readonly TranscriptItem[]): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = [];

  for (const item of items) {
    if (item.kind === "user" || item.kind === "note") {
      blocks.push({ kind: item.kind, item });
      continue;
    }

    const last = blocks.at(-1);
    const turn = last?.kind === "turn" ? last : startTurn(blocks, item);
    addToTurn(turn.parts, item);
  }

  return blocks;
}

function startTurn(blocks: TranscriptBlock[], first: TranscriptItem) {
  const turn = { kind: "turn" as const, id: first.id, at: first.at, parts: [] as TurnPart[] };
  blocks.push(turn);
  return turn;
}

function addToTurn(parts: TurnPart[], item: TranscriptItem): void {
  if (item.kind !== "tool") {
    parts.push({ kind: "text", item });
    return;
  }

  const last = parts.at(-1);
  if (last?.kind === "tools") last.items.push(item);
  else parts.push({ kind: "tools", id: item.id, items: [item] });
}

/** How many kinds of tool a summary names before it says "and more". */
const TOOLS_NAMED = 3;

/** A run of tool calls in one line: "7 steps: Bash 4, Read 2, Web search 1". */
export function summariseTools(items: readonly TranscriptItem[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    const tool = item.tool ?? "Tool";
    counts.set(tool, (counts.get(tool) ?? 0) + 1);
  }

  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  const named = ranked.slice(0, TOOLS_NAMED).map(([tool, count]) => `${tool} ${count}`);
  const more = ranked.length > TOOLS_NAMED ? `, and ${ranked.length - TOOLS_NAMED} more` : "";

  return `${items.length} ${items.length === 1 ? "step" : "steps"}: ${named.join(", ")}${more}`;
}
