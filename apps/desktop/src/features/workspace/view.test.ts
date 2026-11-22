import { describe, expect, it } from "vitest";
import { decodeView, encodeView, type View } from "./view";

describe("view codec", () => {
  it.each<View>([
    { kind: "channel", channelId: "projects" },
    { kind: "room", conversationId: "dm_01abc" },
    { kind: "project", projectId: "89ebc37a-c182", sessionId: null },
    { kind: "project", projectId: "89ebc37a-c182", sessionId: "aca12128-90a6" },
  ])("round-trips %j", (view) => {
    expect(decodeView(encodeView(view))).toEqual(view);
  });

  it.each([null, undefined, "", "room:", "nonsense", "elsewhere:1"])("reads %j as no view", (encoded) => {
    expect(decodeView(encoded)).toBeNull();
  });
});
