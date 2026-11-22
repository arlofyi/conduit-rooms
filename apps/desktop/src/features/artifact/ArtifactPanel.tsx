import type { ArtifactRef } from "@rooms/shared";
import { useMemo, useState } from "react";
import { useArtifact } from "@/api/queries";
import { RefreshIcon } from "@/components/Icons";
import { Button, Drawer, IconButton, Notice, Skeleton } from "@/components/ui";
import { sealArtifact } from "@/lib/sealArtifact";

interface ArtifactPanelProps {
  /** The page to show. Null keeps the panel closed. */
  artifact: ArtifactRef | null;
  author: string;
  onClose: () => void;
}

/**
 * The in-app browser for one artifact: a wide panel that slides in beside
 * the conversation and draws the page an agent wrote.
 *
 * The page is someone else's code, so it is drawn sealed. The frame is
 * sandboxed without "allow-same-origin", which gives it an origin of its own:
 * it cannot read the app, its storage, or the sidecar's token. It may run
 * scripts, and nothing else: no pop-ups, no forms, no navigating the window.
 * sealArtifact adds a policy inside the page that stops it using the network.
 */
export function ArtifactPanel({ artifact, author, onClose }: ArtifactPanelProps) {
  return (
    <Drawer open={artifact !== null} onClose={onClose} title={artifact?.title ?? ""} subtitle={`A page by ${author}`} wide>
      {/* Mounted only while open, so each opening loads the page fresh. */}
      {artifact && <ArtifactPage artifact={artifact} />}
    </Drawer>
  );
}

function ArtifactPage({ artifact }: { artifact: ArtifactRef }) {
  const { data, error, isLoading, mutate } = useArtifact(artifact.id);
  /** Changing a frame's key throws it away and draws the page again from the start. */
  const [drawn, setDrawn] = useState(0);
  const page = useMemo(() => (data ? sealArtifact(data.artifact.html) : null), [data]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-5" aria-hidden>
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="p-4">
        <Notice tone="error" actions={<Button onClick={() => void mutate()}>Try again</Button>}>
          This page could not be loaded.
        </Notice>
      </div>
    );
  }

  return (
    <div className="relative h-full animate-fade-in">
      <IconButton
        label="Draw the page again"
        onClick={() => setDrawn((times) => times + 1)}
        className="absolute right-3 top-2 z-10 border border-line bg-sidebar/90 opacity-60 hover:opacity-100"
      >
        <RefreshIcon size={12} />
      </IconButton>

      <iframe
        key={drawn}
        title={artifact.title}
        srcDoc={page}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className="size-full border-0 bg-panel"
      />
    </div>
  );
}
