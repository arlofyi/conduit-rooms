import type { Message, Project } from "@rooms/shared";
import { memo } from "react";
import { useLiveText } from "@/api/liveText";
import { RefreshIcon } from "@/components/Icons";
import { Avatar, Button, IconButton, Notice, Pulse } from "@/components/ui";
import { formatClock, formatFull } from "@/lib/time";
import { ArtifactCards } from "@/features/artifact/ArtifactCards";
import { StartedSessions } from "@/features/session/StartedSessions";
import { MessageBody } from "./MessageBody";
import { ReplyTrail, StopButton } from "./ReplyTrail";

interface MessageGroupProps {
  /** One author's consecutive messages. Never empty. */
  messages: Message[];
  /** The lead who wrote them, or null when you did. */
  project: Project | null;
  onStop: () => void;
  onRerun: (messageId: string) => void;
  /** The id of the message the current exchange starts at. Messages from it on can be answered again. */
  rerunFrom: string | null;
}

/**
 * One avatar, one name, one timestamp, then the bodies stacked (R-UI-17 to 21).
 * You and leads share this layout, left aligned, with no bubbles: a room has
 * several speakers, and one uniform row is the only layout that stays readable.
 */
export const MessageGroup = memo(function MessageGroup({
  messages,
  project,
  onStop,
  onRerun,
  rerunFrom,
}: MessageGroupProps) {
  const first = messages[0]!;
  const name = project ? project.displayName : "You";

  return (
    <article className="flex animate-rise-in gap-3">
      <Avatar name={project ? name : "U"} color={project?.color} className="mt-0.5" />

      <div className="min-w-0 flex-1">
        <header className="flex items-baseline gap-2">
          <span className="text-title font-semibold text-bright">{name}</span>
          <time dateTime={first.createdAt} title={formatFull(first.createdAt)} className="text-label text-dim">
            {formatClock(first.createdAt)}
          </time>
        </header>

        <div className="mt-0.5 flex flex-col gap-2">
          {messages.map((message) => (
            <MessageEntry
              key={message.id}
              message={message}
              name={name}
              unaidedLabel={project?.kind === "hired" ? "Answered without looking anything up" : "Answered from its brief"}
              // Ids sort by time, so "from this message on" is a comparison.
              canRerun={rerunFrom !== null && message.id >= rerunFrom && message.status !== "failed"}
              onStop={onStop}
              onRerun={onRerun}
            />
          ))}
        </div>
      </div>
    </article>
  );
});

interface MessageEntryProps {
  message: Message;
  name: string;
  /** What to say of a reply that looked nothing up. It depends on who wrote it. */
  unaidedLabel: string;
  /** True when this message can be answered again: it is part of the exchange still under way. */
  canRerun: boolean;
  onStop: () => void;
  onRerun: (messageId: string) => void;
}

/**
 * Under a reply that is being written: a sign that more is coming, and the
 * way to stop it. Before the first word there is nothing here, because the
 * trail above already shows what the lead is doing and carries the stop.
 */
function WritingFooter({ message, onStop }: { message: Message; onStop: () => void }) {
  const text = useLiveText(message.id, message.body);
  if (text.length === 0) return null;

  return (
    <div className="mt-1 flex items-center gap-2">
      <Pulse className="size-1.5" />
      <StopButton onStop={onStop} />
    </div>
  );
}

/** One message and whatever its state adds beneath it: a stop control, a marker, an error. */
function MessageEntry({ message, name, unaidedLabel, canRerun, onStop, onRerun }: MessageEntryProps) {
  return (
    <div className="group/entry relative">
      {canRerun && (
        <IconButton
          label={message.authorKind === "user" ? "Have this answered again" : "Have this reply written again"}
          onClick={() => onRerun(message.id)}
          // Out of the way until the message is pointed at, or the button is reached by keyboard.
          className="absolute -top-1 right-0 bg-panel opacity-0 transition-[opacity,color,background-color,scale] duration-150 focus-visible:opacity-100 group-hover/entry:opacity-100"
        >
          <RefreshIcon size={12} />
        </IconButton>
      )}

      <ReplyTrail message={message} unaidedLabel={unaidedLabel} onStop={onStop} />
      <MessageBody message={message} />
      {message.authorKind === "lead" && <StartedSessions message={message} />}
      {message.authorKind === "lead" && <ArtifactCards message={message} author={name} />}

      {message.status === "streaming" && <WritingFooter message={message} onStop={onStop} />}

      {message.status === "stopped" && <p className="mt-1 text-note text-dim">(stopped)</p>}

      {message.status === "failed" && (
        <Notice
          tone="error"
          className="mt-1.5 max-w-xl"
          actions={
            <Button size="sm" onClick={() => onRerun(message.id)}>
              Retry
            </Button>
          }
        >
          <strong className="font-medium">{name} could not reply.</strong>
          {message.failure && <span className="text-mid"> {message.failure.message}</span>}
        </Notice>
      )}
    </div>
  );
}
