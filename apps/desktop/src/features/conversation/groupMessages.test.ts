import type { Message } from "@rooms/shared";
import { describe, expect, it } from "vitest";
import { groupMessages } from "./groupMessages";

let nextId = 0;

function message(at: string, author: "user" | "lead" | "system", projectId: string | null = null): Message {
  return {
    id: `msg_${String(nextId++).padStart(4, "0")}`,
    conversationId: "dm_1",
    authorKind: author,
    authorProjectId: author === "lead" ? (projectId ?? "p1") : null,
    body: "text",
    mentions: [],
    status: "complete",
    wakeId: null,
    wakeReason: null,
    systemKind: author === "system" ? "joined" : null,
    failure: null,
  steps: null,
  tookMs: null,
    createdAt: at,
    editedAt: null,
  };
}

const shape = (messages: Message[]) =>
  groupMessages(messages).map((item) => (item.kind === "group" ? `group:${item.messages.length}` : item.kind));

describe("groupMessages", () => {
  it("folds one author's messages within five minutes into a group", () => {
    expect(
      shape([
        message("2026-11-21T10:00:00", "user"),
        message("2026-11-21T10:04:00", "user"),
        message("2026-11-21T10:04:30", "lead"),
      ]),
    ).toEqual(["day", "group:2", "group:1"]);
  });

  it("starts a new group after a five minute gap", () => {
    expect(shape([message("2026-11-21T10:00:00", "user"), message("2026-11-21T10:05:01", "user")])).toEqual([
      "day",
      "group:1",
      "group:1",
    ]);
  });

  it("keeps two different leads apart", () => {
    expect(
      shape([message("2026-11-21T10:00:00", "lead", "p1"), message("2026-11-21T10:00:10", "lead", "p2")]),
    ).toEqual(["day", "group:1", "group:1"]);
  });

  it("breaks a group at a system row", () => {
    expect(
      shape([
        message("2026-11-21T10:00:00", "user"),
        message("2026-11-21T10:00:05", "system"),
        message("2026-11-21T10:00:10", "user"),
      ]),
    ).toEqual(["day", "group:1", "system", "group:1"]);
  });

  it("adds a divider when the day changes", () => {
    expect(shape([message("2026-11-20T23:59:00", "user"), message("2026-11-21T00:01:00", "user")])).toEqual([
      "day",
      "group:1",
      "day",
      "group:1",
    ]);
  });
});
