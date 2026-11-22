import { sidecarFetch } from "./client";

/**
 * A server-sent event reader built on fetch, not EventSource, because the
 * sidecar needs its token in a header and EventSource cannot send one.
 * It reconnects on its own until told to stop.
 */

export interface EventStreamHandlers {
  onEvent: (data: string) => void;
  /** Called on every successful connect. `again` is true from the second one on. */
  onOpen: (again: boolean) => void;
  onDrop: () => void;
}

const RETRY_MS = [500, 1_000, 2_000, 5_000];

/** Opens the stream and keeps it open. Returns the function that closes it for good. */
export function openEventStream(path: string, handlers: EventStreamHandlers): () => void {
  const abort = new AbortController();
  void keepReading(path, handlers, abort.signal);
  return () => abort.abort();
}

async function keepReading(path: string, handlers: EventStreamHandlers, signal: AbortSignal): Promise<void> {
  let attempt = 0;
  let hasConnected = false;

  while (!signal.aborted) {
    try {
      const response = await sidecarFetch(path, { signal, headers: { accept: "text/event-stream" } });
      if (!response.ok || !response.body) throw new Error(`Event stream answered ${response.status}`);

      handlers.onOpen(hasConnected);
      hasConnected = true;
      attempt = 0;

      await readEvents(response.body, handlers.onEvent);
    } catch {
      // Fall through to the retry below. An abort ends the loop at its condition.
    }

    if (signal.aborted) return;
    handlers.onDrop();
    await sleep(RETRY_MS[Math.min(attempt++, RETRY_MS.length - 1)]!, signal);
  }
}

/**
 * The sidecar sends a heartbeat every 20 seconds. A stream that has said
 * nothing for this long is not quiet, it is dead: when the sidecar restarts
 * behind a proxy, the connection can stay open with nobody on the other end.
 * Without this the app would sit there, connected to nothing, showing no replies.
 */
const SILENCE_MS = 50_000;

async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (data: string) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser(onEvent);

  for (;;) {
    const { done, value } = await readWithin(reader, SILENCE_MS);
    if (done) return;
    // stream: true holds back a multi-byte character split across two chunks.
    parser.push(decoder.decode(value, { stream: true }));
  }
}

/** Reads the next chunk, or gives up on the stream if none arrives in time. */
async function readWithin(reader: ReadableStreamDefaultReader<Uint8Array>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const silence = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("The event stream went silent.")), ms);
  });

  try {
    return await Promise.race([reader.read(), silence]);
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Turns the raw text of an event stream into the data of each event.
 * Events are separated by a blank line. Lines starting with ":" are comments,
 * which is how the sidecar sends its heartbeat.
 */
export function createSseParser(onEvent: (data: string) => void) {
  let buffer = "";

  return {
    push(chunk: string) {
      buffer += chunk.replace(/\r\n/g, "\n");

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const data = dataOf(buffer.slice(0, boundary));
        if (data !== null) onEvent(data);

        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
      }
    },
  };
}

function dataOf(block: string): string | null {
  const lines = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""));

  return lines.length > 0 ? lines.join("\n") : null;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
  });
}
