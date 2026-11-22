import type { Message } from "@rooms/shared";
import { useDeferredValue, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLiveText } from "@/api/liveText";
import { useKnownHandles } from "@/features/workspace/useKnownHandles";
import { cn } from "@/lib/cn";
import { renderMarkdown } from "@/lib/markdown";
import { addMentionPills } from "@/lib/mentionPills";

/** A body taller than this many rendered lines is clipped (R-UI-25). */
const CLIP_LINES = 20;
const LINE_HEIGHT_PX = 14 * 1.6;
const CLIP_HEIGHT_PX = Math.round(CLIP_LINES * LINE_HEIGHT_PX);

/** Bodies you expanded stay expanded until the app is closed. */
const expanded = new Set<string>();

/**
 * The text of one message, as rendered Markdown.
 *
 * While a reply streams, its text comes from the live store rather than the
 * messages cache, so only this component re-renders as it grows. Parsing
 * Markdown on every keystroke-sized piece would be wasteful, so the parse
 * runs on a deferred copy and React drops intermediate ones when it is busy.
 */
export function MessageBody({ message }: { message: Message }) {
  const text = useLiveText(message.id, message.body);
  const deferredText = useDeferredValue(text);
  const knownHandles = useKnownHandles();
  const html = useMemo(
    () => addMentionPills(renderMarkdown(deferredText), knownHandles),
    [deferredText, knownHandles],
  );

  const isStreaming = message.status === "streaming";
  const { ref, overflows, isExpanded, expand } = useClip(message.id, html, isStreaming);

  if (text.length === 0) return null;

  return (
    <div>
      <div
        ref={ref}
        className={cn("prose", overflows && !isExpanded && "overflow-hidden")}
        style={overflows && !isExpanded ? { maxHeight: CLIP_HEIGHT_PX } : undefined}
        // Safe: renderMarkdown sanitizes against an allowlist, and the pills add only text in a span.
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {overflows && !isExpanded && (
        <button
          type="button"
          onClick={expand}
          className="mt-1 cursor-pointer text-note text-mid hover:text-bright"
        >
          Show more
        </button>
      )}
    </div>
  );
}

/** Measures the rendered body and reports whether it is tall enough to clip. */
function useClip(messageId: string, html: string, isStreaming: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [isExpanded, setExpanded] = useState(() => expanded.has(messageId));

  useLayoutEffect(() => {
    // A reply being written is never clipped: you are reading it as it arrives.
    if (isStreaming || !ref.current) return setOverflows(false);
    setOverflows(ref.current.scrollHeight > CLIP_HEIGHT_PX + LINE_HEIGHT_PX);
  }, [html, isStreaming]);

  const expand = () => {
    expanded.add(messageId);
    setExpanded(true);
  };

  return { ref, overflows, isExpanded, expand };
}
