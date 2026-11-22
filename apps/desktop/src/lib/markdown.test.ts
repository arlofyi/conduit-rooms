import { describe, expect, it } from "vitest";
import { splitInsights } from "./markdown";

const RULE = "─".repeat(40);

describe("splitInsights", () => {
  it("lifts an Insight block out of the text around it, without its rules", () => {
    const source = `Done.\n\n\`★ Insight ${RULE}\`\n- First point.\n- Second point.\n\`${RULE}\`\n\nNext steps follow.`;

    expect(splitInsights(source)).toEqual([
      { kind: "md", text: "Done." },
      { kind: "insight", text: "- First point.\n- Second point." },
      { kind: "md", text: "Next steps follow." },
    ]);
  });

  it("finds a block whose closing rule runs on after the last point, with no backticks", () => {
    const source = `★ Insight ${RULE}\n\nSteps could hold one paragraph.\nTitles got 18. ${RULE}`;

    expect(splitInsights(source)).toEqual([
      { kind: "insight", text: "Steps could hold one paragraph.\nTitles got 18." },
    ]);
  });

  it("finds every block in a message", () => {
    const block = (text: string) => `\`★ Insight ${RULE}\`\n${text}\n\`${RULE}\``;
    const kinds = splitInsights(`${block("One.")}\n\nBetween.\n\n${block("Two.")}`).map((segment) => segment.kind);

    expect(kinds).toEqual(["insight", "md", "insight"]);
  });

  it("leaves text with no block, or with only a short dash, as it is", () => {
    expect(splitInsights("Plain ── text.")).toEqual([{ kind: "md", text: "Plain ── text." }]);
  });
});
