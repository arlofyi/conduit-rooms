import { describe, expect, it } from "vitest";
import { sortByRecentActivity } from "./sortContacts";
import type { Contact } from "./useWorkspace";

function contact(handle: string, lastActivityAt: string | null): Contact {
  return {
    project: { id: handle, kind: "project", handle, displayName: handle, repoPath: `/${handle}`, productId: null, color: "#c4906c" },
    chat: { id: `dm_${handle}`, projectId: handle, addedAt: lastActivityAt, lastActivityAt, leadStatus: "listening" },
  };
}

describe("sortByRecentActivity", () => {
  it("puts recent chats first and never-messaged projects last, alphabetically", () => {
    const sorted = sortByRecentActivity([
      contact("hobbyist", null),
      contact("conduit", "2026-11-20T10:00:00.000Z"),
      contact("arlo", null),
      contact("lavvo", "2026-11-21T10:00:00.000Z"),
    ]);

    expect(sorted.map((entry) => entry.project.handle)).toEqual(["lavvo", "conduit", "arlo", "hobbyist"]);
  });
});
