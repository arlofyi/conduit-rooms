import type { ArtifactRef, Message } from "@rooms/shared";
import { useState } from "react";
import { useArtifacts } from "@/api/queries";
import { ChevronRightIcon, FileIcon } from "@/components/Icons";
import { ArtifactPanel } from "./ArtifactPanel";

interface ArtifactCardsProps {
  message: Message;
  /** Who wrote the message, shown in the panel beside the page's title. */
  author: string;
}

/**
 * The pages a reply came with, each as a card under it. Clicking one opens
 * the page in a panel beside the conversation.
 *
 * It reads the conversation's list of artifacts, which every reply in the
 * conversation shares as one cached request, and picks out its own.
 */
export function ArtifactCards({ message, author }: ArtifactCardsProps) {
  const { data } = useArtifacts(message.conversationId);
  const [viewing, setViewing] = useState<ArtifactRef | null>(null);

  const own = data?.artifacts.filter((artifact) => artifact.messageId === message.id) ?? [];
  if (own.length === 0) return null;

  return (
    <>
      <ul className="mt-2 flex flex-wrap gap-2">
        {own.map((artifact) => (
          <li key={artifact.id} className="animate-pop-in">
            <button
              type="button"
              onClick={() => setViewing(artifact)}
              className="group/card flex max-w-80 cursor-pointer items-center gap-2.5 rounded-card border border-line bg-sidebar/70 py-2 pl-2 pr-3 text-left transition-[border-color,background-color,translate,box-shadow] duration-200 ease-settle hover:-translate-y-0.5 hover:border-accent-line hover:bg-accent-wash hover:shadow-menu active:translate-y-0"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
                <FileIcon size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ui font-medium text-bright">{artifact.title}</span>
                <span className="block text-label text-mid">Page</span>
              </span>
              <ChevronRightIcon
                size={13}
                className="shrink-0 text-dim transition-[translate,color] duration-200 ease-settle group-hover/card:translate-x-0.5 group-hover/card:text-accent"
              />
            </button>
          </li>
        ))}
      </ul>

      <ArtifactPanel artifact={viewing} author={author} onClose={() => setViewing(null)} />
    </>
  );
}
