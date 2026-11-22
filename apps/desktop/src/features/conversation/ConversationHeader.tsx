import type { LeadStatus } from "@rooms/shared";
import type { ReactNode } from "react";
import { Pulse, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";

interface ConversationHeaderProps {
  title: string;
  status: LeadStatus;
  /** Buttons at the right edge. */
  actions?: ReactNode;
}

/** The bar above a conversation: who it is with, what they are doing, and its actions. */
export function ConversationHeader({ title, status, actions }: ConversationHeaderProps) {
  return (
    <header className="shrink-0 border-b border-line/60">
      <div className="drag-region" data-tauri-drag-region />
      <div className="flex items-center gap-2.5 px-5 pb-2.5">
        <h1 className="truncate text-title font-semibold text-soft">{title}</h1>
        <LeadStatusWord status={status} />
        {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

const STATUS_WORD: Record<LeadStatus, string> = {
  listening: "listening",
  joining: "joining",
  speaking: "speaking",
  error: "unavailable",
};

/**
 * The one word that says what a lead is doing. The word is always there as
 * text: the indicator beside it is decoration, never the only signal (R-UI-63).
 */
export function LeadStatusWord({ status }: { status: LeadStatus }) {
  return (
    <span
      role="status"
      className={cn("flex items-center gap-1.5 text-note", status === "error" ? "text-bad" : "text-mid")}
    >
      {status === "joining" && <Spinner size={11} />}
      {status === "speaking" && <Pulse />}
      {STATUS_WORD[status]}
    </span>
  );
}
