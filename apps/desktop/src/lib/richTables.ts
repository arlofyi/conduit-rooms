/**
 * Makes a Markdown table read like a table someone designed, by looking at
 * what is in each column:
 *
 *   a column of numbers          is set flush right, so the digits line up
 *   a column of paths or links   is set in the code face
 *   a column of verdicts         shows each verdict as a coloured mark, with whatever
 *                                follows it ("200, untouched", "Good: three stages") beside it, dimmed
 *
 * Every rule is decided per column, and a column is only treated as one of
 * these when every cell in it fits. One cell that does not fit leaves the
 * whole column as plain text, which is always a safe way to show it.
 *
 * The classifiers are pure and tested on their own. Only `enrichTables`
 * touches the DOM.
 */

export type Tone = "good" | "warn" | "bad";

export interface Verdict {
  /** The verdict itself: "200", "Good". */
  mark: string;
  tone: Tone;
  /** What was said after it, if anything. */
  note: string;
}

export type ColumnKind = "number" | "path" | "verdict" | "text";

const WORDS: Record<Tone, readonly string[]> = {
  good: ["ok", "yes", "pass", "passed", "passes", "done", "good", "fine", "live", "fixed", "works", "ready", "shipped"],
  warn: ["partial", "loose", "pending", "untested", "unknown", "warning", "skipped", "todo", "wip", "maybe"],
  bad: ["no", "fail", "failed", "fails", "broken", "error", "missing", "blocked"],
};

const TONE_OF = new Map(
  (Object.keys(WORDS) as Tone[]).flatMap((tone) => WORDS[tone].map((word) => [word, tone] as const)),
);

/** A verdict stands alone, or is set off from its note by punctuation or brackets. "No building yet" is a sentence, not a verdict. */
const VERDICT_SHAPE = /^([A-Za-z]+|\d{3})(?:\s*[,:;.]\s*(.+)|\s+\((.+)\))?$/;

/** A three-digit number is only a status code when its column says so. */
const STATUS_HEADER = /status|result|code|response|http/i;

export function verdictOf(cell: string, header: string): Verdict | null {
  const match = VERDICT_SHAPE.exec(cell.trim());
  if (!match) return null;

  const mark = match[1]!;
  const note = (match[2] ?? match[3] ?? "").trim();

  if (/^\d{3}$/.test(mark)) {
    const tone = STATUS_HEADER.test(header) ? httpTone(Number(mark)) : null;
    return tone && { mark, tone, note };
  }

  const tone = TONE_OF.get(mark.toLowerCase());
  return tone ? { mark, tone, note } : null;
}

function httpTone(code: number): Tone | null {
  if (code >= 200 && code < 300) return "good";
  if (code >= 300 && code < 400) return "warn";
  return code >= 400 && code < 600 ? "bad" : null;
}

const NUMBER = /^[-+]?[$€£]?\d[\d,]*(\.\d+)?\s?(%|[kmb]n?|ms|s|x|px|kb|mb|gb)?$/i;
const PATH = /^(https?:\/\/\S+|~?\/\S*|\.{1,2}\/\S+|[\w-]+(\.[\w-]+)+(\/\S*)?)$/;

/** What a column holds, judged from its header and every cell that has something in it. */
export function columnKind(header: string, cells: readonly string[]): ColumnKind {
  const filled = cells.map((cell) => cell.trim()).filter(Boolean);
  if (filled.length === 0) return "text";

  const all = (fits: (cell: string) => boolean) => filled.every(fits);

  if (all((cell) => verdictOf(cell, header) !== null)) return "verdict";
  if (all((cell) => NUMBER.test(cell))) return "number";
  // One path proves little: a lone word with a dot in it could be anything.
  if (filled.length > 1 && all((cell) => PATH.test(cell))) return "path";
  return "text";
}

/** Browser-only. Takes sanitized HTML and returns it with its tables enriched. */
export function enrichTables(html: string): string {
  if (!html.includes("<table")) return html;

  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const table of Array.from(doc.querySelectorAll("table"))) enrich(table, doc);
  return doc.body.innerHTML;
}

function enrich(table: HTMLTableElement, doc: Document): void {
  const headers = Array.from(table.querySelectorAll("thead th"));
  const rows = Array.from(table.querySelectorAll("tbody tr")).map((row) => Array.from(row.querySelectorAll("td")));

  headers.forEach((header, column) => {
    const cells = rows.flatMap((row) => (row[column] ? [row[column]] : []));
    const title = header.textContent ?? "";

    // A cell with markup inside it (a link, bold text) has already been given a look by its author.
    const plain = cells.every((cell) => cell.children.length === 0);
    const kind = plain ? columnKind(title, cells.map((cell) => cell.textContent ?? "")) : "text";

    if (kind === "number") for (const cell of [header, ...cells]) cell.classList.add("is-num");
    if (kind === "path") for (const cell of cells) cell.classList.add("is-path");
    if (kind === "verdict") for (const cell of cells) showVerdict(cell, title, doc);
  });
}

function showVerdict(cell: Element, header: string, doc: Document): void {
  const verdict = verdictOf(cell.textContent ?? "", header);
  if (!verdict) return;

  const mark = doc.createElement("span");
  mark.className = "cell-mark";
  mark.dataset.tone = verdict.tone;
  mark.textContent = verdict.mark;

  cell.textContent = "";
  cell.append(mark);

  if (verdict.note) {
    const note = doc.createElement("span");
    note.className = "cell-note";
    note.textContent = verdict.note;
    cell.append(note);
  }
}
