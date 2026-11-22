import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { renderMarkdown, splitInsights } from "@/lib/markdown";

/**
 * Markdown as an agent wrote it, drawn as prose. An `★ Insight` block, which
 * Claude writes between two rules of dashes, is drawn as a card of its own
 * instead of as the rules it arrived with.
 */
interface MarkdownProps {
  text: string;
  /** Gives paragraphs, lists and tables more air, for long answers. */
  roomy?: boolean;
  className?: string;
}

export function Markdown({ text, roomy = false, className }: MarkdownProps) {
  const segments = useMemo(
    () => splitInsights(text).map((segment) => ({ kind: segment.kind, html: renderMarkdown(segment.text) })),
    [text],
  );

  const prose = cn("prose", roomy && "prose-roomy");

  return (
    <div className={cn("flex flex-col", roomy ? "gap-4" : "gap-2", className)}>
      {segments.map((segment, index) =>
        segment.kind === "insight" ? (
          <aside
            key={index}
            className={cn("rounded-card border border-accent-line bg-accent-wash", roomy ? "px-4 py-3" : "px-3 py-2")}
          >
            <p className={cn("text-label font-medium text-accent", roomy ? "mb-2" : "mb-1")}>★ Insight</p>
            {/* Safe: renderMarkdown sanitizes against an allowlist (lib/markdown.ts). */}
            <div className={prose} dangerouslySetInnerHTML={{ __html: segment.html }} />
          </aside>
        ) : (
          <div key={index} className={prose} dangerouslySetInnerHTML={{ __html: segment.html }} />
        ),
      )}
    </div>
  );
}
