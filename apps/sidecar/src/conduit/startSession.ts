import { randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Starts an agent session in Conduit, on a project, with a brief.
 *
 * Rooms does not start the agent itself and does not touch Conduit's state.
 * It asks Conduit to, over the local API Conduit runs for its own `conduit`
 * command (src-tauri/src/cli_open.rs there):
 *
 *   POST http://127.0.0.1:<port>/open
 *   X-Conduit-Token: <token>
 *   { "path", "agent", "name", "prompt_file", "worktree" }
 *
 * Conduit writes the port and a token for this run into its data folder each
 * time it starts. Conduit then opens the session as if you had started it
 * there: in its sidebar, under its rules, with its hooks.
 */

export interface NewSession {
  /** The project's repo. Conduit adds it as a project if it is not one already. */
  repoPath: string;
  /** Shown in Conduit's sidebar and in Rooms'. */
  name: string;
  /** The first message the agent is given. */
  brief: string;
  /** When set, the session works on a branch of its own in a separate worktree, named from this. */
  worktree?: string;
}

/** Conduit's own limits. */
export const SESSION_NAME_MAX_LENGTH = 80;
export const SESSION_BRIEF_MAX_LENGTH = 60_000;

export class SessionNotStartedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "SessionNotStartedError";
  }
}

export type StartSession = (session: NewSession) => Promise<void>;

const NOT_RUNNING = "Conduit is not running. Open Conduit, then try again.";

/** Builds the function that starts sessions through the Conduit whose data folder this is. */
export function conduitSessionStarter(conduitDataDir: string): StartSession {
  return async ({ repoPath, name, brief, worktree }) => {
    const endpoint = await readEndpoint(conduitDataDir);
    if (!endpoint) throw new SessionNotStartedError(NOT_RUNNING);

    // Conduit takes the brief as a file it reads itself. Readable by you alone, and removed once it has been read.
    const briefFile = join(tmpdir(), `conduit-rooms-brief-${randomUUID()}.md`);
    await writeFile(briefFile, brief, { mode: 0o600 });

    try {
      const response = await fetch(`http://127.0.0.1:${endpoint.port}/open`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-conduit-token": endpoint.token },
        body: JSON.stringify({ path: repoPath, agent: "claude", name, prompt_file: briefFile, worktree }),
        signal: AbortSignal.timeout(15_000),
      }).catch(() => null);

      if (!response) throw new SessionNotStartedError(NOT_RUNNING);
      if (!response.ok) throw new SessionNotStartedError(refusal(response.status));
    } finally {
      await rm(briefFile, { force: true });
    }
  };
}

/** Where Conduit is listening and the token it wants, or null when it has never run or its files are gone. */
async function readEndpoint(conduitDataDir: string): Promise<{ port: number; token: string } | null> {
  const [endpoint, token] = await Promise.all([
    readFile(join(conduitDataDir, "hook-endpoint.sh"), "utf8").catch(() => ""),
    readFile(join(conduitDataDir, "cli-token"), "utf8").catch(() => ""),
  ]);

  const port = Number(/CONDUIT_HOOK_PORT=(\d+)/.exec(endpoint)?.[1]);
  return port && token.trim() ? { port, token: token.trim() } : null;
}

function refusal(status: number): string {
  switch (status) {
    case 403:
      return "Conduit refused the request. Restart Conduit, then try again.";
    case 400:
      return "Conduit did not accept the session's name or brief.";
    default:
      return `Conduit answered with an error (${status}).`;
  }
}
