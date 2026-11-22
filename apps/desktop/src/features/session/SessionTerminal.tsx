import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { routes, type ProjectSession, type SessionTerminal as TerminalSnapshot } from "@rooms/shared";
import { useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { sendSessionInput } from "@/api/mutations";
import { useSessionTerminal } from "@/api/queries";
import { EmptyState, Notice, Spinner } from "@/components/ui";
import { TERMINAL_THEMES } from "@/theme/terminalThemes";
import { useTheme } from "@/theme/ThemeProvider";

const FONT_FAMILY = '"SF Mono", SFMono-Regular, Menlo, monospace';

/** Keys pressed within this long go out together, so a paste is one request and not hundreds. */
const KEY_BATCH_MS = 25;

/** How long after your last key the screen keeps refreshing quickly. */
const TYPING_LINGER_MS = 4_000;

/**
 * A session's terminal, drawn with xterm.js like Conduit draws it, and you
 * can type into it.
 *
 * It is not a connection. The screen is a picture that refreshes, and your
 * keys are handed to the real terminal one batch at a time. That is what
 * lets Rooms show a session without attaching to it and resizing it in
 * Conduit. The cost is a short lag between a key and seeing it land.
 */
export function SessionTerminal({ session }: { session: ProjectSession }) {
  const [typing, setTyping] = useState(false);
  const { data, isLoading } = useSessionTerminal(session.id, typing);
  const { theme } = useTheme();
  const terminal = data?.terminal;

  const hostRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const { send, error } = useKeySender(session.id, setTyping);

  // One xterm instance for as long as this session's terminal is on screen.
  useEffect(() => {
    if (!hostRef.current) return;

    const xterm = new Terminal({
      cursorBlink: true,
      cursorInactiveStyle: "outline",
      fontFamily: FONT_FAMILY,
      fontSize: 12,
      scrollback: 2_000,
      convertEol: true,
    });
    xterm.open(hostRef.current);
    xterm.focus();

    // xterm turns each key into the bytes a real terminal would send. Those go to the session as they are.
    const keys = xterm.onData(send);
    xtermRef.current = xterm;

    return () => {
      keys.dispose();
      xterm.dispose();
      xtermRef.current = null;
    };
  }, [terminal?.running, send]);

  useEffect(() => {
    if (xtermRef.current) xtermRef.current.options.theme = TERMINAL_THEMES[theme];
  }, [theme, terminal?.running]);

  useEffect(() => {
    if (xtermRef.current && terminal?.running) draw(xtermRef.current, terminal);
  }, [terminal]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size={16} />
      </div>
    );
  }

  if (!terminal?.running) {
    return (
      <EmptyState title="This session is not running">
        Its terminal opens when you start the session in Conduit.
      </EmptyState>
    );
  }

  return (
    <>
      {error && (
        <Notice tone="error" className="m-2">
          Your keys did not reach the session. {error.message}
        </Notice>
      )}
      <div
        className="min-h-0 flex-1 cursor-text overflow-auto bg-panel px-4 py-3"
        onClick={() => xtermRef.current?.focus()}
      >
        <div ref={hostRef} aria-label={`Terminal of ${session.name}`} />
      </div>
    </>
  );
}

/**
 * Replaces what xterm shows with a fresh capture, keeping your scroll
 * position, then puts the cursor where it is in the real terminal.
 */
function draw(xterm: Terminal, terminal: TerminalSnapshot): void {
  const buffer = xterm.buffer.active;
  const wasAtBottom = buffer.viewportY >= buffer.baseY;
  const scrolledTo = buffer.viewportY;

  xterm.resize(Math.max(terminal.cols, 20), Math.max(terminal.rows, 5));
  xterm.reset();

  // The capture's last `rows` lines are the visible screen, so once written they fill the
  // viewport and a cursor position counted from the screen's top left lands in the right cell.
  const moveCursor = `\x1b[${terminal.cursor.y + 1};${terminal.cursor.x + 1}H`;

  xterm.write(terminal.screen + moveCursor, () => {
    if (wasAtBottom) xterm.scrollToBottom();
    else xterm.scrollToLine(scrolledTo);
  });
}

/**
 * Collects keys for a moment and sends them as one request, in order. After
 * each send it asks for a fresh screen, and reports that you are typing so
 * the screen keeps refreshing quickly for a while.
 */
function useKeySender(sessionId: string, setTyping: (typing: boolean) => void) {
  const { mutate } = useSWRConfig();
  const [error, setError] = useState<Error | null>(null);
  const [send] = useState(() => {
    let pending = "";
    let batchTimer: ReturnType<typeof setTimeout> | undefined;
    let lingerTimer: ReturnType<typeof setTimeout> | undefined;
    // Each batch waits for the one before it, so keys can never arrive out of order.
    let inFlight: Promise<void> = Promise.resolve();

    const flush = () => {
      const data = pending;
      pending = "";

      inFlight = inFlight
        .then(() => sendSessionInput(sessionId, data))
        .then(() => {
          setError(null);
          void mutate(routes.sessionTerminal(sessionId));
        })
        .catch((cause: Error) => setError(cause));
    };

    return (data: string) => {
      pending += data;
      clearTimeout(batchTimer);
      batchTimer = setTimeout(flush, KEY_BATCH_MS);

      setTyping(true);
      clearTimeout(lingerTimer);
      lingerTimer = setTimeout(() => setTyping(false), TYPING_LINGER_MS);
    };
  });

  return { send, error };
}
