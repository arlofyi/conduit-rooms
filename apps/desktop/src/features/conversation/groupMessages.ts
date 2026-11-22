import type { Message } from "@rooms/shared";
import { dayKey } from "@/lib/time";

/**
 * Turns a flat list of messages into what the stream draws:
 * a divider when the day changes (R-UI-22), system rows on their own, and
 * runs of messages from one author within five minutes folded into a single
 * group with one avatar and one name (R-UI-21).
 */
export type StreamItem =
  | { kind: "day"; key: string; at: string }
  | { kind: "system"; key: string; message: Message }
  | { kind: "group"; key: string; messages: Message[] };

const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function groupMessages(messages: readonly Message[]): StreamItem[] {
  const items: StreamItem[] = [];
  let currentDay: string | null = null;
  // The message a new one may fold into. Null after anything that breaks a run.
  let groupTail: Message | null = null;

  for (const message of messages) {
    const day = dayKey(message.createdAt);
    if (day !== currentDay) {
      items.push({ kind: "day", key: `day-${day}`, at: message.createdAt });
      currentDay = day;
      groupTail = null;
    }

    if (message.authorKind === "system") {
      items.push({ kind: "system", key: message.id, message });
      groupTail = null;
      continue;
    }

    const last = items.at(-1);
    if (last?.kind === "group" && groupTail && continuesGroup(groupTail, message)) {
      last.messages.push(message);
    } else {
      items.push({ kind: "group", key: message.id, messages: [message] });
    }
    groupTail = message;
  }

  return items;
}

function continuesGroup(previous: Message, next: Message): boolean {
  const sameAuthor =
    previous.authorKind === next.authorKind && previous.authorProjectId === next.authorProjectId;
  const gap = Date.parse(next.createdAt) - Date.parse(previous.createdAt);

  return sameAuthor && gap <= GROUP_WINDOW_MS;
}
