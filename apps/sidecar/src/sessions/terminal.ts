import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import type { SessionTerminal } from "@rooms/shared";

const run = promisify(execFile);

/**
 * A session's terminal: reading its screen, and typing into it. Conduit
 * keeps every session in tmux, and tmux lets another process do both from
 * the outside.
 *
 * Rooms never attaches to a session. An attached client would share its
 * window size with Conduit and resize the terminal you are working in.
 * Reading uses `capture-pane`. Typing uses `paste-buffer` and `send-keys`,
 * which Conduit's own terminal sees exactly as if you had typed there.
 */

/** The tmux server Conduit runs its sessions on, and how it names them (conduit src-tauri/src/tmux.rs). */
const SOCKET = "conduit";
const sessionName = (sessionId: string) => `cdt-${sessionId.replace(/[^A-Za-z0-9_-]/g, "_")}`;

/** How far back to read, in lines above the visible screen. */
const HISTORY_LINES = 400;

const NOT_RUNNING: SessionTerminal = {
  running: false,
  cols: 0,
  rows: 0,
  cursor: { x: 0, y: 0 },
  screen: "",
};

export class SessionNotRunningError extends Error {
  constructor() {
    super("This session is not running, so there is nothing to type into.");
    this.name = "SessionNotRunningError";
  }
}

// ---- Reading ----

export async function readTerminal(sessionId: string): Promise<SessionTerminal> {
  const target = sessionName(sessionId);

  try {
    const [layout, screen] = await Promise.all([
      tmux(["display-message", "-p", "-t", target, "#{pane_width} #{pane_height} #{cursor_x} #{cursor_y}"]),
      // -e keeps colors, -J rejoins lines the terminal wrapped, -S reaches back into history.
      tmux(["capture-pane", "-p", "-e", "-J", "-S", `-${HISTORY_LINES}`, "-t", target]),
    ]);

    const [cols = 0, rows = 0, x = 0, y = 0] = layout.trim().split(" ").map(Number);

    // The capture ends with a newline after the last screen line. Kept, it would
    // push everything up one row and put the cursor on the wrong line.
    return { running: true, cols, rows, cursor: { x, y }, screen: screen.replace(/\r?\n$/, "") };
  } catch {
    // No such tmux session, no tmux server, or no tmux at all: either way there is no terminal to show.
    return NOT_RUNNING;
  }
}

// ---- Typing ----

/**
 * Sends a whole message to the session's agent and submits it.
 *
 * The text goes in as a bracketed paste, so the agent receives a message with
 * several lines as one message. Typed key by key, the first newline would
 * submit it early.
 */
export async function sendMessage(sessionId: string, text: string, imagePaths: readonly string[] = []): Promise<void> {
  const target = sessionName(sessionId);

  try {
    // Each picture is its own paste. Claude Code attaches an image when what was pasted is the path of
    // one, and takes a moment to read the file, so it is given that moment before the next thing arrives.
    for (const path of imagePaths) {
      await paste(target, path);
      await pause(IMAGE_SETTLE_MS);
      // A typed space keeps one picture apart from the next, and from the words that follow.
      await tmux(["send-keys", "-t", target, "-l", " "]);
    }
    if (text) await paste(target, text);

    await tmux(["send-keys", "-t", target, "Enter"]);
  } catch {
    throw new SessionNotRunningError();
  }
}

const IMAGE_SETTLE_MS = 250;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Pastes text into a session the way a terminal does, so the program in it can tell a paste from typing. */
async function paste(target: string, text: string): Promise<void> {
  const buffer = `rooms-${process.pid}`;

  await tmuxWithInput(["load-buffer", "-b", buffer, "-"], text);
  // -p pastes in bracketed mode, -d deletes the buffer once pasted.
  await tmux(["paste-buffer", "-p", "-d", "-b", buffer, "-t", target]);
}

/** Sends keystrokes exactly as a terminal would: arrows, Escape and Ctrl combinations included. */
export async function sendInput(sessionId: string, data: string): Promise<void> {
  // -H takes each byte as hex, which carries control characters that have no name in tmux.
  const bytes = [...Buffer.from(data, "utf8")].map((byte) => byte.toString(16).padStart(2, "0"));
  if (bytes.length === 0) return;

  try {
    await tmux(["send-keys", "-t", sessionName(sessionId), "-H", ...bytes]);
  } catch {
    throw new SessionNotRunningError();
  }
}

// ---- tmux ----

async function tmux(args: string[]): Promise<string> {
  const { stdout } = await run("tmux", ["-L", SOCKET, ...args], { maxBuffer: 8 * 1024 * 1024 });
  return stdout;
}

/** Runs tmux with text on its standard input. Used to hand over a message without it touching a shell. */
function tmuxWithInput(args: string[], input: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("tmux", ["-L", SOCKET, ...args], { stdio: ["pipe", "ignore", "ignore"] });

    child.once("error", reject);
    child.once("close", (code) => (code === 0 ? resolve() : reject(new Error(`tmux exited with ${code}`))));
    child.stdin.end(input);
  });
}
