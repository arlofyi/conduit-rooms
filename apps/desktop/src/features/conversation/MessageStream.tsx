import type { Message, Project } from "@rooms/shared";
import { useCallback, useMemo, type ReactNode } from "react";
import { useRerunMessage, useStopReply } from "@/api/mutations";
import { useMessages } from "@/api/queries";
import { ArrowDownIcon } from "@/components/RoomsIcons";
import { Button, EmptyState, Notice } from "@/components/ui";
import { groupMessages } from "./groupMessages";
import { MessageGroup } from "./MessageGroup";
import { DayDivider, JoiningRow, StreamSkeleton, SystemRow } from "./StreamRows";
import { useStickToBottom } from "./useStickToBottom";

interface MessageStreamProps {
  conversationId: string;
  /** Who wrote a lead message. Called with the message's author project id. */
  projectOf: (projectId: string) => Project | undefined;
  /** Leads that are reading their project for the first time, shown as joining. */
  joining: Project[];
  /** What to say when there are no messages yet. */
  emptyState: ReactNode;
}

/**
 * The scrolling history of one conversation: oldest at the top, newest at
 * the bottom. It works the same for a project room and a common room. It
 * reads the messages cache and nothing else. Live events change that cache
 * from outside (api/workspaceEvents.ts), and this component re-renders with
 * the result.
 */
export function MessageStream({ conversationId, projectOf, joining, emptyState }: MessageStreamProps) {
  const { data, error, isLoading, mutate } = useMessages(conversationId);
  const { trigger: stop } = useStopReply(conversationId);
  const { trigger: rerun } = useRerunMessage(conversationId);

  const messages = data?.messages;
  const items = useMemo(() => groupMessages(messages ?? []), [messages]);
  const { scrollRef, contentRef, isPinned, jumpToLatest } = useStickToBottom(
    conversationId,
    messages !== undefined,
  );

  // Stable identities, so a memoised group does not re-render when its neighbours change.
  const onStop = useCallback(() => void stop(), [stop]);
  const onRerun = useCallback((messageId: string) => void rerun(messageId), [rerun]);
  const rerunFrom = useMemo(() => currentExchangeStart(messages ?? []), [messages]);

  if (isLoading) {
    return (
      <StreamFrame>
        <StreamSkeleton />
      </StreamFrame>
    );
  }

  if (error && !messages) {
    return (
      <StreamFrame>
        <Notice tone="error" actions={<Button onClick={() => void mutate()}>Try again</Button>}>
          This conversation could not be loaded.
        </Notice>
      </StreamFrame>
    );
  }

  if (items.length === 0 && joining.length === 0) {
    return <EmptyState>{emptyState}</EmptyState>;
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} className="h-full overflow-y-auto px-5 py-6">
        <div ref={contentRef} className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
          {items.map((item) => {
            switch (item.kind) {
              case "day":
                return <DayDivider key={item.key} at={item.at} />;
              case "system":
                return <SystemRow key={item.key} message={item.message} />;
              case "group": {
                const authorId = item.messages[0]!.authorProjectId;
                return (
                  <MessageGroup
                    key={item.key}
                    messages={item.messages}
                    project={authorId ? (projectOf(authorId) ?? null) : null}
                    onStop={onStop}
                    onRerun={onRerun}
                    rerunFrom={rerunFrom}
                  />
                );
              }
            }
          })}

          {joining.map((project) => (
            <JoiningRow key={project.id} project={project} conversationId={conversationId} />
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

      <LatestReplyAnnouncer messages={messages ?? []} projectOf={projectOf} />
    </div>
  );
}

/**
 * The id of your latest message, from which on a message can be answered
 * again: that message, and the replies to it. Anything earlier is settled
 * history, and answering it again would really answer what came after it.
 * Null while a reply is being written, when nothing should be set off twice.
 */
function currentExchangeStart(messages: readonly Message[]): string | null {
  if (messages.some((message) => message.status === "streaming")) return null;
  return messages.findLast((message) => message.authorKind === "user")?.id ?? null;
}

function StreamFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden px-5 py-6">
      <div className="mx-auto w-full max-w-[720px]">{children}</div>
    </div>
  );
}

/**
 * Tells a screen reader about a lead's reply once, when it is complete
 * (R-UI-62). Announcing each streamed piece would read the reply out in shreds.
 */
function LatestReplyAnnouncer({
  messages,
  projectOf,
}: {
  messages: Message[];
  projectOf: MessageStreamProps["projectOf"];
}) {
  const latest = messages.findLast((message) => message.authorKind === "lead" && message.status !== "streaming");
  const name = latest?.authorProjectId ? projectOf(latest.authorProjectId)?.displayName : undefined;

  return (
    <div aria-live="polite" className="sr-only">
      {latest && name && `${name}: ${latest.body}`}
    </div>
  );
}
