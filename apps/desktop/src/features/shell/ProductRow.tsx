import { useWorkspace } from "@/features/workspace/useWorkspace";
import { useStoredFlag } from "@/lib/useStoredFlag";
import type { ProductEntry } from "./arrangeSidebar";
import { FolderMark, ProjectRow, RowStatus } from "./ProjectRow";
import { SidebarFold } from "./SidebarRow";
import { TreeChildren, TreeRow } from "./TreeRow";

/**
 * A product: its name opens the room where its lead speaks for all of its
 * repos, and beneath it are the repos themselves. The ones that are busy or
 * that you talk to are listed. The rest wait behind one line.
 */
export function ProductRow({ entry }: { entry: ProductEntry }) {
  const { contact, status, repos, quietRepos } = entry;
  const { project, chat } = contact;
  const { view, open } = useWorkspace();

  const [expanded, setExpanded] = useStoredFlag(`rooms.product.${project.id}.open`, true);
  const selected = view?.kind === "room" && view.conversationId === chat.id;
  const [showQuiet, setShowQuiet] = useStoredFlag(`rooms.product.${project.id}.quiet`, false);

  return (
    <li>
      <TreeRow
        label={project.displayName}
        strong
        leading={<FolderMark color={project.color} />}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
        selected={selected}
        onSelect={() => {
          setExpanded(selected ? !expanded : true);
          open({ kind: "room", conversationId: chat.id });
        }}
        trailing={<RowStatus status={status} contact={contact} />}
      />

      {expanded && (
        <TreeChildren>
          {repos.length + quietRepos.length === 0 && <li className="px-[7px] py-1 text-ui text-dim">No repos yet</li>}

          {repos.map((repo) => (
            <ProjectRow key={repo.project.id} contact={repo} nested />
          ))}

          {quietRepos.length > 0 && (
            <li>
              <SidebarFold
                label={quietRepos.length === 1 ? "1 quiet repo" : `${quietRepos.length} quiet repos`}
                open={showQuiet}
                onToggle={() => setShowQuiet(!showQuiet)}
              />
            </li>
          )}
          {showQuiet && quietRepos.map((repo) => <ProjectRow key={repo.project.id} contact={repo} nested />)}
        </TreeChildren>
      )}
    </li>
  );
}
