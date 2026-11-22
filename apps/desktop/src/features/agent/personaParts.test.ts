import { describe, expect, it } from "vitest";
import { parsePersona } from "./personaParts";

describe("parsePersona", () => {
  it("splits a persona written in the usual shape", () => {
    const parts = parsePersona(
      "Conduit is a desktop app for running agents.\nAsk me about: terminal tabs, PTY sessions, tmux keep-alive.\nNot mine: the Tauri framework itself, Tailscale.",
    );

    expect(parts).toEqual({
      summary: "Conduit is a desktop app for running agents.",
      askAbout: ["terminal tabs", "PTY sessions", "tmux keep-alive"],
      notMine: ["the Tauri framework itself", "Tailscale"],
    });
  });

  it("copes with a persona that has no Not mine line", () => {
    expect(parsePersona("A thing.\nAsk me about: one, two")).toMatchObject({ askAbout: ["one", "two"], notMine: [] });
  });

  it("returns null for free text, so it is shown as written", () => {
    expect(parsePersona("I answer questions about billing and nothing else.")).toBeNull();
  });
});
