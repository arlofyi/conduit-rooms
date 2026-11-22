import type { Project } from "@rooms/shared";
import { useCallback, useMemo, useState } from "react";
import { Button, ErrorBoundary } from "@/components/ui";
import { AgentDrawer } from "@/features/agent/AgentDrawer";
import { ProductDialog } from "@/features/product/ProductDialog";
import { useWorkspace, type Contact } from "@/features/workspace/useWorkspace";
import { Composer } from "./Composer";
import { ConversationHeader } from "./ConversationHeader";
import { MessageStream } from "./MessageStream";

/**
 * A project room: your private line to one project's lead (the spec's
 * "direct chat", specs/06-direct-chats.md). Header, history, composer, and the
 * drawer holding the agent's persona and brief.
 *
 * A product's room is the same screen with more people in it: the product's
 * lead answers, and the lead of any repo under it answers when you tag it.
 */
export function DirectChatView({ contact }: { contact: Contact }) {
  const { chat, project } = contact;
  const { contacts, open } = useWorkspace();
  const [agentOpen, setAgentOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(false);

  /** The repo leads that can be tagged here. Empty unless this is a product's room. */
  const repos = useMemo(
    () => contacts.map((entry) => entry.project).filter((entry) => entry.productId === project.id),
    [contacts, project.id],
  );

  const projectOf = useCallback(
    (projectId: string) => (projectId === project.id ? project : repos.find((repo) => repo.id === projectId)),
    [project, repos],
  );
  const joining = useMemo(() => (chat.leadStatus === "joining" ? [project] : []), [chat.leadStatus, project]);
  const mentionable = useMemo(
    () => repos.map((repo) => ({ handle: repo.handle, label: repo.displayName })),
    [repos],
  );

  return (
    <>
      <ConversationHeader
        title={project.displayName}
        status={chat.leadStatus}
        actions={
          <>
            {project.kind === "product" && <Button onClick={() => setEditingProduct(true)}>Repos</Button>}
            {project.kind === "project" && (
              <Button onClick={() => open({ kind: "project", projectId: project.id, sessionId: null })}>Sessions</Button>
            )}
            <Button onClick={() => setAgentOpen(true)}>Persona</Button>
          </>
        }
      />

      <ErrorBoundary name="this conversation" resetKey={chat.id}>
        <MessageStream conversationId={chat.id} projectOf={projectOf} joining={joining} emptyState={welcome(project, repos)} />
      </ErrorBoundary>

      {/* Keyed by chat, so each conversation gets its own draft and focus. */}
      <Composer
        key={chat.id}
        conversationId={chat.id}
        placeholder={`Message ${project.handle}`}
        mentionable={mentionable.length > 0 ? mentionable : undefined}
      />

      <AgentDrawer project={agentOpen ? project : null} onClose={() => setAgentOpen(false)} />
      {project.kind === "product" && (
        <ProductDialog open={editingProduct} onClose={() => setEditingProduct(false)} product={project} />
      )}
    </>
  );
}

/** What an empty room says, so you know who is on the other end and what it can do. */
function welcome(project: Project, repos: readonly Project[]): string {
  const line = `This is your direct line to ${project.displayName}.`;

  switch (project.kind) {
    case "hired":
      return `${line} It knows your projects by their briefs and can search the web.`;
    case "product":
      return repos.length === 0
        ? `${line} It has no repos yet. Add some with the Repos button above.`
        : `${line} Its lead speaks for the whole product. To hear from one repo's lead, tag it: ${repos.map((repo) => `@${repo.handle}`).join(", ")}.`;
    case "project":
      return `${line} Ask it anything about the project.`;
  }
}
