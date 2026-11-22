import { describe, expect, it } from "vitest";
import { itemsOf } from "./transcript";

const record = (fields: object) => JSON.stringify({ uuid: "u1", timestamp: "2026-11-21T10:00:00Z", ...fields });

describe("itemsOf", () => {
  it("shows what a person typed", () => {
    const line = record({ type: "user", origin: { kind: "human" }, message: { content: "Fix the login bug" } });
    expect(itemsOf(line)).toEqual([
      { id: "u1", kind: "user", text: "Fix the login bug", at: "2026-11-21T10:00:00Z" },
    ]);
  });

  it("hides user records that are machinery", () => {
    const toolResult = record({
      type: "user",
      message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }] },
    });
    const reminder = record({ type: "user", message: { content: "<system-reminder>be brief</system-reminder>" } });
    const hook = record({ type: "user", origin: { kind: "hook" }, message: { content: "hook said hi" } });

    expect([toolResult, reminder, hook].flatMap(itemsOf)).toEqual([]);
  });

  it("splits an assistant record into its text and its tool calls, skipping thinking", () => {
    const line = record({
      type: "assistant",
      message: {
        content: [
          { type: "thinking", thinking: "hmm" },
          { type: "text", text: "Looking at the config." },
          { type: "tool_use", name: "Read", input: { file_path: "src/config.ts" } },
        ],
      },
    });

    expect(itemsOf(line).map((item) => [item.kind, item.tool, item.text])).toEqual([
      ["assistant", undefined, "Looking at the config."],
      ["tool", "Read", "src/config.ts"],
    ]);
  });

  it("keeps a tool summary to one short line", () => {
    const line = record({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "Bash", input: { command: `echo ${"x".repeat(300)}\nls` } }] },
    });
    const [item] = itemsOf(line);

    expect(item!.text).not.toContain("\n");
    expect(item!.text.length).toBeLessThan(160);
  });

  it("ignores subagent records, bookkeeping records and broken lines", () => {
    const sidechain = record({ type: "assistant", isSidechain: true, message: { content: "from a subagent" } });
    const bookkeeping = record({ type: "file-history-snapshot" });

    expect([sidechain, bookkeeping, '{"type":"assis', ""].flatMap(itemsOf)).toEqual([]);
  });

  const toolCall = (name: string, input: object) =>
    itemsOf(record({ type: "assistant", message: { content: [{ type: "tool_use", name, input }] } }))[0]!;

  it("describes a command by what Claude said it was for", () => {
    const item = toolCall("Bash", { command: "python3 - <<'EOF'\nimport re\nEOF", description: "Rename the helper" });
    expect(item).toMatchObject({ tool: "Bash", text: "Rename the helper" });
  });

  it("names a connector's tool the way a person would", () => {
    expect(toolCall("mcp__claude-in-chrome__browser_batch", { actions: [] })).toMatchObject({
      tool: "claude-in-chrome",
      text: "browser batch",
    });
    expect(toolCall("mcp__claude_ai_Notion__notion-search", { query: "Clients" })).toMatchObject({
      tool: "Notion",
      text: "notion search: Clients",
    });
  });

  it("shows a compaction as one line, not as pages of summary you never typed", () => {
    const line = record({
      type: "user",
      isCompactSummary: true,
      message: { content: "This session is being continued from a previous conversation..." },
    });

    expect(itemsOf(line)).toMatchObject([{ kind: "note", text: expect.stringContaining("summarised") }]);
  });

  it("shows where you stopped Claude", () => {
    const line = record({ type: "user", message: { content: [{ type: "text", text: "[Request interrupted by user]" }] } });
    expect(itemsOf(line)).toMatchObject([{ kind: "note", text: "You stopped Claude here." }]);
  });

  it("counts the pictures that came with a message", () => {
    const line = record({
      type: "user",
      origin: { kind: "human" },
      message: { content: [{ type: "text", text: "[Image #2] Hero is too empty." }, { type: "image" }] },
    });

    expect(itemsOf(line)).toMatchObject([{ kind: "user", text: "[Image #2] Hero is too empty.", images: 1 }]);
  });

  it("shows the question Claude put to you, and your answer as something you said", () => {
    const question = "How should the cost question be answered?";
    const asked = toolCall("AskUserQuestion", { questions: [{ question }] });
    const answered = record({
      type: "user",
      toolUseResult: { answers: { [question]: "No figure, explain shape" } },
      message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "..." }] },
    });

    expect(asked).toMatchObject({ tool: "Asked you", text: question });
    expect(itemsOf(answered)).toMatchObject([{ kind: "user", text: "No figure, explain shape" }]);
  });
});
