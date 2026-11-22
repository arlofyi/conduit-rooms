import { describe, expect, it } from "vitest";
import { columnKind, enrichTables, verdictOf } from "./richTables";

describe("verdictOf", () => {
  it("reads a status code under a header that says it is one", () => {
    expect(verdictOf("200, untouched", "Result")).toEqual({ mark: "200", tone: "good", note: "untouched" });
    expect(verdictOf("404", "Status")).toEqual({ mark: "404", tone: "bad", note: "" });
    expect(verdictOf("301", "HTTP code")?.tone).toBe("warn");
  });

  it("does not take a three-digit number for a status code under any other header", () => {
    expect(verdictOf("200", "Lines changed")).toBeNull();
  });

  it("reads a verdict word, alone or followed by its reason", () => {
    expect(verdictOf("Good: three stages, each builds on the last", "Fit")).toEqual({
      mark: "Good",
      tone: "good",
      note: "three stages, each builds on the last",
    });
    expect(verdictOf("Loose. Reads three cities", "Fit")?.tone).toBe("warn");
    expect(verdictOf("Failed (timeout)", "Run")).toEqual({ mark: "Failed", tone: "bad", note: "timeout" });
  });

  it("does not take the first word of a sentence for a verdict", () => {
    expect(verdictOf("No building yet", "State")).toBeNull();
    expect(verdictOf("Good morning to all", "Note")).toBeNull();
    expect(verdictOf("Calm line, one glowing dot", "Picture")).toBeNull();
  });
});

describe("columnKind", () => {
  it("calls a column a verdict column only when every cell is a verdict", () => {
    expect(columnKind("Fit", ["Fine, quiet", "Good", "Loose. Not quite"])).toBe("verdict");
    expect(columnKind("Fit", ["Fine, quiet", "Three stacks of blocks"])).toBe("text");
  });

  it("recognises numbers, with their units and signs", () => {
    expect(columnKind("Size", ["$4.6bn", "64%", "1,200", "-3", "0.16%", "24ms"])).toBe("number");
    expect(columnKind("Size", ["12", "about 40"])).toBe("text");
  });

  it("recognises paths and addresses, given more than one", () => {
    expect(columnKind("URL", ["uziiuzair.com", "/about", "/images/og.png", "https://tauri.app/x"])).toBe("path");
    expect(columnKind("URL", ["uziiuzair.com"])).toBe("text");
    expect(columnKind("Screen", ["A safe place to build", "/about"])).toBe("text");
  });

  it("ignores empty cells, and has nothing to say about an empty column", () => {
    expect(columnKind("Count", ["12", "", "7"])).toBe("number");
    expect(columnKind("Count", ["", " "])).toBe("text");
  });
});

describe("enrichTables", () => {
  const table = (head: string[], rows: string[][]) =>
    `<table><thead><tr>${head.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead><tbody>${rows
      .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`;

  it("marks up each column by what it holds", () => {
    const html = enrichTables(
      table(["URL", "Result", "Size"], [
        ["/about", "200", "12kb"],
        ["/builders-space", "200, new vision page", "40kb"],
      ]),
    );

    expect(html).toContain('<td class="is-path">/about</td>');
    expect(html).toContain('<span class="cell-mark" data-tone="good">200</span><span class="cell-note">new vision page</span>');
    expect(html).toContain('<th class="is-num">Size</th>');
    expect(html).toContain('<td class="is-num">40kb</td>');
  });

  it("leaves a column alone when a cell in it already has markup", () => {
    const html = enrichTables(table(["Fit"], [["<strong>Good</strong>"], ["Fine"]]));
    expect(html).not.toContain("cell-mark");
  });

  it("returns text with no table untouched", () => {
    expect(enrichTables("<p>Good, no table here.</p>")).toBe("<p>Good, no table here.</p>");
  });
});
