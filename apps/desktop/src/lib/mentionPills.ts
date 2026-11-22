import { splitMentions } from "@rooms/shared";

/** Text inside these is shown as written. A handle in a code sample is not a mention. */
const SKIP_INSIDE = new Set(["CODE", "PRE", "A"]);

/**
 * Wraps each "@handle" of a known project in a pill (R-UI-24). Unknown
 * handles are left as plain text.
 *
 * It works on already sanitized HTML and only ever adds a <span> holding
 * text, so it cannot introduce anything the sanitizer would have removed.
 */
export function addMentionPills(html: string, knownHandles: ReadonlySet<string>): string {
  if (!html.includes("@")) return html;

  const body = new DOMParser().parseFromString(html, "text/html").body;
  const walker = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_TEXT);

  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  for (const node of textNodes) {
    if (isInside(node, SKIP_INSIDE)) continue;

    const parts = splitMentions(node.data);
    if (!parts.some((part) => part.handle && knownHandles.has(part.handle))) continue;

    node.replaceWith(
      ...parts.map((part) => {
        if (!part.handle || !knownHandles.has(part.handle)) return part.text;

        const pill = body.ownerDocument.createElement("span");
        pill.className = "mention";
        pill.textContent = part.text;
        return pill;
      }),
    );
  }

  return body.innerHTML;
}

function isInside(node: Node, tags: ReadonlySet<string>): boolean {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    if (tags.has(parent.tagName)) return true;
  }
  return false;
}
