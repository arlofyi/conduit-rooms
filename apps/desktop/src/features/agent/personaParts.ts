/**
 * A persona is plain text you can write any way you like. When it follows
 * the shape a lead writes it in, it can be shown more readably:
 *
 *   {Name} is ...                 one sentence
 *   Ask me about: a, b, c.        topics
 *   Not mine: x, y.               things that are not this agent's
 *
 * Text that does not follow that shape is shown exactly as written.
 */
export interface PersonaParts {
  summary: string;
  askAbout: string[];
  notMine: string[];
}

const ASK_ABOUT = /^ask me about:/i;
const NOT_MINE = /^not mine:/i;

export function parsePersona(body: string): PersonaParts | null {
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const askLine = lines.find((line) => ASK_ABOUT.test(line));
  if (!askLine) return null;

  const notMineLine = lines.find((line) => NOT_MINE.test(line));
  const summary = lines.filter((line) => line !== askLine && line !== notMineLine).join(" ");

  return {
    summary,
    askAbout: topicsOf(askLine),
    notMine: notMineLine ? topicsOf(notMineLine) : [],
  };
}

/** "Ask me about: tabs, PTY sessions." gives ["tabs", "PTY sessions"]. */
function topicsOf(line: string): string[] {
  return line
    .slice(line.indexOf(":") + 1)
    .split(",")
    .map((topic) => topic.trim().replace(/\.$/, ""))
    .filter(Boolean);
}
