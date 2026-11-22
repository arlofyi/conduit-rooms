import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions, Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { useMemo, useState, type ReactNode } from "react";
import { useActivity, useRooms } from "@/api/queries";
import { ChatBubbleIcon, FolderIcon, TerminalIcon } from "@/components/Icons";
import { HashIcon } from "@/components/RoomsIcons";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { listJumpTargets, matchJumpTargets, type JumpTarget } from "./jumpTargets";

interface JumpPaletteProps {
  open: boolean;
  onClose: () => void;
}

/** More than this is a list nobody reads. Typing another letter is quicker than scrolling. */
const SHOWN = 40;

/**
 * Jump to anything by typing part of its name: a room, a project's lead, an
 * agent, or a session running in Conduit. Arrow keys move, Enter opens.
 */
export function JumpPalette({ open, onClose }: JumpPaletteProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-panel/60 transition-opacity duration-150 ease-out data-closed:opacity-0"
      />
      <div className="fixed inset-0 flex items-start justify-center p-6 pt-[14vh]">
        <DialogPanel
          transition
          className="flex max-h-[60vh] w-full max-w-[520px] flex-col overflow-hidden rounded-modal border border-line bg-panel shadow-modal transition duration-150 ease-settle data-closed:scale-[0.98] data-closed:opacity-0"
        >
          {/* Mounted only while open, so every opening starts with an empty box. */}
          {open && <JumpList onClose={onClose} />}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function JumpList({ onClose }: { onClose: () => void }) {
  const { contacts, open: openView } = useWorkspace();
  const rooms = useRooms();
  const activity = useActivity();
  const [typed, setTyped] = useState("");

  const targets = useMemo(
    () => listJumpTargets(rooms.data?.rooms ?? [], contacts, activity.data?.activity ?? []),
    [rooms.data, contacts, activity.data],
  );
  const matches = useMemo(() => matchJumpTargets(targets, typed).slice(0, SHOWN), [targets, typed]);

  function jump(target: JumpTarget | null) {
    if (!target) return;
    openView(target.view);
    onClose();
  }

  return (
    <Combobox<JumpTarget | null> value={null} onChange={jump}>
      <ComboboxInput
        autoFocus
        placeholder="Jump to a room, a project, an agent or a session"
        aria-label="Jump to"
        onChange={(event) => setTyped(event.target.value)}
        className="w-full shrink-0 border-b border-line bg-transparent px-4 py-3 text-title text-bright outline-none placeholder:text-dim"
      />

      <ComboboxOptions static className="min-h-0 overflow-y-auto p-1.5 empty:hidden">
        {matches.map((target) => (
          <ComboboxOption
            key={`${target.kind}:${target.id}`}
            value={target}
            className="flex cursor-pointer items-center gap-2.5 rounded-row px-2.5 py-1.5 text-ui text-mid data-focus:bg-selection data-focus:text-bright"
          >
            <span className="flex w-3.5 shrink-0 justify-center text-dim">{MARK[target.kind]}</span>
            <span className="min-w-0 truncate text-bright">{target.label}</span>
            {target.context && <span className="min-w-0 truncate text-dim">{target.context}</span>}
            <span className="ml-auto shrink-0 text-label text-dim">{target.kind}</span>
          </ComboboxOption>
        ))}
      </ComboboxOptions>

      {matches.length === 0 && <p className="px-4 py-4 text-ui text-dim">Nothing is called that.</p>}
    </Combobox>
  );
}

const MARK: Record<JumpTarget["kind"], ReactNode> = {
  room: <HashIcon size={12} />,
  product: <FolderIcon size={12} />,
  project: <ChatBubbleIcon size={12} />,
  agent: <ChatBubbleIcon size={12} />,
  session: <TerminalIcon size={12} />,
};
