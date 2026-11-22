import { useMemo, useState } from "react";
import { useActivity, useRooms } from "@/api/queries";
import { HashIcon } from "@/components/RoomsIcons";
import { Avatar, Pulse } from "@/components/ui";
import { HireDialog } from "@/features/agent/HireDialog";
import { JumpPalette } from "@/features/jump/JumpPalette";
import { ProductDialog } from "@/features/product/ProductDialog";
import { RoomDialog } from "@/features/room/RoomDialog";
import { useOpenRoomOf } from "@/features/workspace/useOpenRoomOf";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { useHotkey } from "@/lib/useHotkey";
import { useStoredFlag } from "@/lib/useStoredFlag";
import { AddMenu } from "./AddMenu";
import { arrangeSidebar, type StatusOf } from "./arrangeSidebar";
import { LeadActivity } from "./LeadActivity";
import { ProductRow } from "./ProductRow";
import { ProjectRow } from "./ProjectRow";
import { SidebarFold, SidebarRow, SidebarSectionLabel } from "./SidebarRow";
import { ThemeMenu } from "./ThemeMenu";

type Making = "room" | "agent" | "product" | null;

/**
 * The sidebar, top to bottom:
 *
 *   Find or jump   Cmd+K: go to anything by name
 *   Rooms          your common rooms and the agents you hired. The "+" makes a room, an agent or a product.
 *   Projects       every project once. Its name is where you talk to its lead, and its arrow shows
 *                  what Conduit is running in it. What needs you comes first, then what is working.
 *   Quiet          the projects that are idle and that you have never talked to, folded away
 *
 * What goes where, and in what order, is decided in arrangeSidebar.ts.
 * Exactly one row is selected at a time: the one whose view is open.
 */
export function Sidebar() {
  const { contacts, view, open } = useWorkspace();
  const rooms = useRooms();
  const activity = useActivity();
  const openRoomOf = useOpenRoomOf();

  const [making, setMaking] = useState<Making>(null);
  const [jumping, setJumping] = useState(false);
  const [showQuiet, setShowQuiet] = useStoredFlag("rooms.sidebar.quiet", false);

  useHotkey("k", () => setJumping((current) => !current));

  const { agents, entries, quiet } = useMemo(() => {
    const statuses = new Map(activity.data?.activity.map((entry) => [entry.projectId, entry.status]));
    const statusOf: StatusOf = (projectId) => statuses.get(projectId) ?? "idle";
    return arrangeSidebar(contacts, statusOf);
  }, [contacts, activity.data]);

  const stopMaking = () => setMaking(null);

  return (
    <>
      <div className="px-2 pb-1">
        <button
          type="button"
          onClick={() => setJumping(true)}
          className="flex w-full cursor-pointer items-center rounded-control border border-line px-2 py-[5px] text-left text-ui text-dim transition-[color,border-color,scale] duration-[120ms] hover:border-accent-line hover:text-mid active:scale-[0.985]"
        >
          Find or jump
          <kbd className="ml-auto font-mono text-badge">⌘K</kbd>
        </button>
      </div>

      <nav aria-label="Rooms and projects" className="min-h-0 flex-1 overflow-y-auto p-1.5 pt-0">
        <SidebarSectionLabel
          action={
            <AddMenu
              onNewRoom={() => setMaking("room")}
              onHireAgent={() => setMaking("agent")}
              onNewProduct={() => setMaking("product")}
            />
          }
        >
          Rooms
        </SidebarSectionLabel>
        <ul className="mb-1">
          {rooms.data?.rooms.map((room) => {
            const selected = view?.kind === "channel" && view.channelId === room.id;
            return (
              <li key={room.id}>
                <SidebarRow
                  label={room.name}
                  leading={<HashIcon size={12} className={selected ? "text-accent" : "text-mid"} />}
                  trailing={room.members.some((member) => member.leadStatus === "speaking") && <Pulse />}
                  selected={selected}
                  onSelect={() => open({ kind: "channel", channelId: room.id })}
                />
              </li>
            );
          })}
          {agents.map((contact) => (
            <li key={contact.chat.id}>
              <SidebarRow
                label={contact.project.displayName}
                leading={<Avatar name={contact.project.displayName} color={contact.project.color} size={15} />}
                trailing={<LeadActivity contact={contact} />}
                selected={view?.kind === "room" && view.conversationId === contact.chat.id}
                onSelect={() => open({ kind: "room", conversationId: contact.chat.id })}
              />
            </li>
          ))}
        </ul>

        <SidebarSectionLabel>Projects</SidebarSectionLabel>
        {entries.length + quiet.length === 0 ? (
          <p className="select-text px-[7px] py-1 text-ui leading-normal text-dim">
            No projects found. Add a project in Conduit first.
          </p>
        ) : (
          <ul>
            {entries.map((entry) =>
              entry.kind === "product" ? (
                <ProductRow key={entry.contact.project.id} entry={entry} />
              ) : (
                <ProjectRow key={entry.contact.project.id} contact={entry.contact} />
              ),
            )}
          </ul>
        )}

        {quiet.length > 0 && (
          <div className="mt-1.5 border-t border-line pt-1.5">
            <SidebarFold label="Quiet" count={quiet.length} open={showQuiet} onToggle={() => setShowQuiet(!showQuiet)} />
            {showQuiet && (
              <ul>
                {quiet.map((contact) => (
                  <ProjectRow key={contact.project.id} contact={contact} />
                ))}
              </ul>
            )}
          </div>
        )}
      </nav>

      <footer className="flex items-center border-t border-line px-1.5 py-1">
        <ThemeMenu />
      </footer>

      <JumpPalette open={jumping} onClose={() => setJumping(false)} />
      <RoomDialog
        open={making === "room"}
        onClose={stopMaking}
        onSaved={(room) => open({ kind: "channel", channelId: room.id })}
      />
      <HireDialog open={making === "agent"} onClose={stopMaking} onHired={(agent) => openRoomOf(agent.id)} />
      <ProductDialog open={making === "product"} onClose={stopMaking} onSaved={(product) => openRoomOf(product.id)} />
    </>
  );
}
