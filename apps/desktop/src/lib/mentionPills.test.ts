import { describe, expect, it } from "vitest";
import { addMentionPills } from "./mentionPills";

const known = new Set(["hobbyist", "conduit", "all"]);

describe("addMentionPills", () => {
  it("wraps a known handle in a pill", () => {
    expect(addMentionPills("<p>hey @hobbyist, ship it</p>", known)).toBe(
      '<p>hey <span class="mention">@hobbyist</span>, ship it</p>',
    );
  });

  it("leaves unknown handles as plain text", () => {
    expect(addMentionPills("<p>ask @lavvo</p>", known)).toBe("<p>ask @lavvo</p>");
  });

  it("does not touch handles inside code or links", () => {
    const html = '<p><code>@conduit</code> and <a href="https://x.dev">@conduit</a></p>';
    expect(addMentionPills(html, known)).toBe(html);
  });
});
