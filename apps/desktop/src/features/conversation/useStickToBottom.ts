import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/** How close to the end counts as "at the bottom", so a pixel of rounding does not unpin you. */
const PINNED_WITHIN_PX = 48;

interface StickToBottom {
  scrollRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  /** False once you have scrolled up to read. Drives the "Jump to latest" pill. */
  isPinned: boolean;
  jumpToLatest: () => void;
}

/**
 * Auto-scroll for a message stream (R-UI-29): if you were at the bottom when
 * new content arrived, you stay there. If you had scrolled up, nothing moves.
 *
 * Content grows without React knowing (a streaming reply changes height many
 * times a second), so growth is watched with a ResizeObserver, not an effect.
 * The scroll position is remembered per conversation and restored on return.
 */
export function useStickToBottom(conversationId: string, ready: boolean): StickToBottom {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [isPinned, setIsPinned] = useState(true);

  const scrollToBottom = useCallback(() => {
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, []);

  // Restore where you were the last time this conversation was open.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !ready) return;

    const fromBottom = readScroll(conversationId);
    const restore = () => {
      scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight - fromBottom;
    };

    const pinned = fromBottom <= PINNED_WITHIN_PX;
    pinnedRef.current = pinned;
    setIsPinned(pinned);

    // Once now, so the first paint is already in place, and once more after
    // long messages have measured and clipped themselves, which changes heights.
    restore();
    const frame = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(frame);
  }, [conversationId, ready]);

  // Track whether you are at the bottom, and remember the position.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !ready) return;

    const onScroll = () => {
      const fromBottom = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
      const pinned = fromBottom <= PINNED_WITHIN_PX;

      pinnedRef.current = pinned;
      setIsPinned(pinned);
      storeScroll(conversationId, pinned ? 0 : fromBottom);
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [conversationId, ready]);

  // Follow the content as it grows, but only while pinned.
  useEffect(() => {
    const content = contentRef.current;
    if (!content || !ready) return;

    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) scrollToBottom();
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [ready, scrollToBottom]);

  const jumpToLatest = useCallback(() => {
    pinnedRef.current = true;
    setIsPinned(true);
    scrollToBottom();
  }, [scrollToBottom]);

  return { scrollRef, contentRef, isPinned, jumpToLatest };
}

const storageKey = (conversationId: string) => `rooms.scroll.${conversationId}`;

function readScroll(conversationId: string): number {
  try {
    return Number(localStorage.getItem(storageKey(conversationId))) || 0;
  } catch {
    return 0;
  }
}

function storeScroll(conversationId: string, fromBottom: number): void {
  try {
    localStorage.setItem(storageKey(conversationId), String(Math.round(fromBottom)));
  } catch {
    // Storage is unavailable. You will land at the bottom next time.
  }
}
