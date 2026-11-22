import { slugifyHandle, type ParticipantKind, type Room } from "@rooms/shared";
import { useMemo, useState, type FormEvent } from "react";
import { useSaveRoom } from "@/api/mutations";
import { Badge, Button, Modal, TextField } from "@/components/ui";
import { ParticipantChecklist, toggleId } from "@/features/workspace/ParticipantChecklist";
import { useWorkspace } from "@/features/workspace/useWorkspace";

interface RoomDialogProps {
  open: boolean;
  onClose: () => void;
  /** The room to change. Leave out to create a new one. */
  room?: Room;
  /** Called with the saved room, after the dialog has closed. */
  onSaved?: (room: Room) => void;
}

/** Creates a common room, or changes its name and who is in it. */
export function RoomDialog({ open, onClose, room, onSaved }: RoomDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={room ? `#${room.name}` : "New room"}>
      {/* Mounted only while open, so every opening starts from the room as it is now. */}
      {open && <RoomForm room={room} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function RoomForm({ room, onClose, onSaved }: Omit<RoomDialogProps, "open">) {
  const { contacts } = useWorkspace();
  const { trigger: save, isMutating: isSaving, error, reset } = useSaveRoom(room?.id ?? null);

  const [name, setName] = useState(room?.name ?? "");
  const [memberIds, setMemberIds] = useState<string[]>(() => room?.members.map((member) => member.projectId) ?? []);

  // Agents and products come first: there are few of them, and they are the ones you add to most rooms.
  const everyone = useMemo(
    () => contacts.map((contact) => contact.project).sort((a, b) => LISTED[a.kind] - LISTED[b.kind]),
    [contacts],
  );

  const finalName = slugifyRoomName(name, { trimEnds: true });
  const canSave = finalName.length >= 2 && !isSaving;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;

    try {
      const saved = await save({ name: finalName, memberIds });
      onClose();
      onSaved?.(saved);
    } catch {
      // The sidecar's reason is on screen under the name field.
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-col">
      <div className="flex min-h-0 flex-col gap-4 px-[22px] pb-1">
        <TextField
          label="Name"
          prefix="#"
          autoFocus={!room}
          value={name}
          placeholder="plugin-api"
          maxLength={32}
          hint="Lowercase letters, numbers and dashes."
          error={error?.message}
          onChange={(event) => {
            setName(slugifyRoomName(event.target.value));
            if (error) reset();
          }}
        />

        <ParticipantChecklist
          label="Who is in this room"
          options={everyone}
          chosenIds={memberIds}
          // Order of ticking is the order members are listed in the room.
          onToggle={(projectId) => setMemberIds((current) => toggleId(current, projectId))}
          filterPlaceholder="Find an agent or a project"
          note={({ kind }) => kind !== "project" && <Badge tone="accent">{KIND_BADGE[kind]}</Badge>}
        />
      </div>

      <footer className="flex items-center justify-end gap-2 px-[22px] py-4">
        <Button size="md" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button size="md" variant="primary" type="submit" disabled={!canSave} loading={isSaving}>
          {room ? "Save" : "Create room"}
        </Button>
      </footer>
    </form>
  );
}

/** Where each kind sits in the list. The sort is stable, so within a kind the sidebar's order stands. */
const LISTED: Record<ParticipantKind, number> = { hired: 0, product: 1, project: 2 };

const KIND_BADGE = { hired: "agent", product: "product" } as const;

/**
 * Keeps a room name to the characters a name may have, as you type: spaces
 * become dashes, capitals become lowercase, anything else is dropped.
 * A trailing dash is left alone while typing, or "plugin-" could never become "plugin-api".
 */
function slugifyRoomName(input: string, { trimEnds = false } = {}): string {
  if (trimEnds) return input ? slugifyHandle(input) : "";

  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 32);
}
