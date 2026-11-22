import type { Project, ProjectSession, TranscriptItem } from "@rooms/shared";
import { memo, useMemo, useState, type ReactNode } from "react";
import { useSendSessionMessage } from "@/api/mutations";
import { useSessionTranscript } from "@/api/queries";
import { ChevronRightIcon } from "@/components/Icons";
import { Markdown } from "@/components/Markdown";
import { ArrowDownIcon } from "@/components/RoomsIcons";
import { Avatar, Button, EmptyState, Notice } from "@/components/ui";
import { ComposerBox } from "@/features/conversation/ComposerBox";
import { encodeImages, useImageAttachments } from "@/features/conversation/useImageAttachments";
import { StreamSkeleton } from "@/features/conversation/StreamRows";
import { useStickToBottom } from "@/features/conversation/useStickToBottom";
import { cn } from "@/lib/cn";
import { formatClock, formatFull } from "@/lib/time";
import { groupTranscript, summariseTools, type TranscriptBlock } from "./groupTranscript";

interface SessionChatProps {
  project: Project;
  session: ProjectSession;
}

/**
 * A session's conversation, read from the transcript its agent writes
 * (Conduit's "rich session view"), with a box to send it a message. What you
 * send is typed into the session's terminal, so Conduit sees it too.
 */
export function SessionChat({ project, session }: SessionChatProps) {
  return (
    <>
      <Transcript project={project} session={session} />
      <SessionComposer session={session} />
    </>
  );
}

function SessionComposer({ session }: { session: ProjectSession }) {
  const [text, setText] = useState("");
  const images = useImageAttachments();
  const { trigger: send, isMutating, error, reset } = useSendSessionMessage(session.id);
  const running = session.status !== "stopped";

  return (
    <ComposerBox
      text={text}
      onTextChange={setText}
      onSend={async (message) => {
        await send({ text: message, images: await encodeImages(images.items) });
        setText("");
        images.clear();
      }}
      isSending={isMutating}
      error={error}
      onClearError={reset}
      disabled={!running}
      placeholder={running ? `Message ${session.name}` : "This session is not running. Start it in Conduit to message it."}
      // Only Claude attaches a picture from its path. For any other agent the path would arrive as text.
      images={session.agent === "claude" ? images : undefined}
      focusKey={session.id}
    />
  );
}

function Transcript({ project, session }: SessionChatProps) {
  const { data, error, isLoading, mutate } = useSessionTranscript(session.id);
  const transcript = data?.transcript;
  const { scrollRef, contentRef, isPinned, jumpToLatest } = useStickToBottom(
    `session:${session.id}`,
    transcript !== undefined,
  );
  const blocks = useMemo(() => groupTranscript(transcript?.items ?? []), [transcript]);

  if (isLoading) {
    return (
      <Frame>
        <StreamSkeleton />
      </Frame>
    );
  }

  if (error && !transcript) {
    return (
      <Frame>
        <Notice tone="error" actions={<Button onClick={() => void mutate()}>Try again</Button>}>
          This session's conversation could not be read.
        </Notice>
      </Frame>
    );
  }

  if (transcript?.unavailable === "not_claude") {
    return (
      <EmptyState title="No chat view for this agent">
        Only Claude sessions keep a conversation Rooms can read. Use the terminal view for this one.
      </EmptyState>
    );
  }

  if (!transcript || transcript.items.length === 0) {
    return <EmptyState>Nothing has been said in this session yet.</EmptyState>;
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} className="h-full overflow-y-auto px-5 py-6">
        <div ref={contentRef} className="mx-auto flex w-full max-w-[720px] flex-col gap-8">
          {transcript.truncated && (
            <p className="text-center text-note text-dim">
              This is a long session. Only its most recent part is shown.
            </p>
          )}

          {blocks.map((block, index) => (
            <BlockRow
              key={block.kind === "turn" ? block.id : block.item.id}
              block={block}
              project={project}
              live={session.status === "working" && index === blocks.length - 1}
            />
          ))}
        </div>
      </div>

      {!isPinned && (
        <Button
          onClick={jumpToLatest}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 animate-pop-in rounded-full shadow-menu"
        >
          <ArrowDownIcon size={12} />
          Jump to latest
        </Button>
      )}
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden px-5 py-6">
      <div className="mx-auto w-full max-w-[720px]">{children}</div>
    </div>
  );
}

/**
 * One block of the conversation. Memoised: a poll returns the whole list
 * again, and blocks that did not change should not re-render.
 */
const BlockRow = memo(function BlockRow({ block, project, live }: { block: TranscriptBlock; project: Project; live: boolean }) {
  switch (block.kind) {
    case "note":
      return (
        <div className="flex animate-rise-in justify-center">
          <span className="inline-flex max-w-full items-center rounded-full border border-line/60 bg-selection/40 px-3 py-[3px] text-center text-note text-mid">
            {block.item.text}
          </span>
        </div>
      );

    case "user":
      return (
        <Speaker name="You" avatar="U" at={block.item.at}>
          <Markdown text={block.item.text} roomy className="mt-1" />
          {block.item.images && (
            <p className="mt-1 text-label text-dim">
              {block.item.images === 1 ? "1 picture attached" : `${block.item.images} pictures attached`}
            </p>
          )}
        </Speaker>
      );

    case "turn":
      return (
        <Speaker name={project.displayName} avatar={project.displayName} color={project.color} at={block.at}>
          <div className="mt-1.5 flex flex-col gap-3.5">
            {block.parts.map((part, index) =>
              part.kind === "text" ? (
                <Markdown key={part.item.id} text={part.item.text} roomy />
              ) : (
                <ToolRun key={part.id} items={part.items} startOpen={live && index === block.parts.length - 1} />
              ),
            )}
          </div>
        </Speaker>
      );
  }
});

interface SpeakerProps {
  name: string;
  avatar: string;
  color?: string;
  at: string | null;
  children: ReactNode;
}

/** The frame every speaker's block shares: avatar, name, time, then what was said. */
function Speaker({ name, avatar, color, at, children }: SpeakerProps) {
  return (
    <article className="flex animate-rise-in gap-3">
      <Avatar name={avatar} color={color} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <header className="flex items-baseline gap-2">
          <span className="text-title font-semibold text-bright">{name}</span>
          {at && (
            <time dateTime={at} title={formatFull(at)} className="text-label text-dim">
              {formatClock(at)}
            </time>
          )}
        </header>
        {children}
      </div>
    </article>
  );
}

/**
 * A run of tool calls, folded to one line that says how many and of what
 * kind. Click it to see each call. The run Claude is in the middle of starts
 * out open, so you can watch it work.
 */
function ToolRun({ items, startOpen }: { items: TranscriptItem[]; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex max-w-full cursor-pointer items-center gap-1 rounded-row border border-line py-px pl-1 pr-2 text-label text-mid transition-[color,border-color,scale] duration-[120ms] hover:border-accent-line hover:text-bright active:scale-[0.97]"
      >
        <ChevronRightIcon size={11} className={cn("shrink-0 transition-transform duration-150 ease-settle", open && "rotate-90")} />
        <span className="truncate">{summariseTools(items)}</span>
      </button>

      {open && (
        <ol className="mt-1 flex animate-rise-in flex-col gap-0.5 border-l border-line pl-2.5">
          {items.map((item) => (
            <li key={item.id} className="flex min-w-0 select-text gap-2 text-ui" title={item.text}>
              <span className="w-[5.5rem] shrink-0 truncate text-dim">{item.tool}</span>
              <span className="min-w-0 truncate text-mid">{item.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
