import { useEffect, useState } from "react";
import { useWorkspace } from "./useWorkspace";

/**
 * Returns a function that opens the room of a project, product or agent,
 * given its id. It is for the moment right after you make one: the lists the
 * sidebar reads are refreshed by then, but this render has not seen them yet,
 * so the room is opened on the render where it first appears.
 */
export function useOpenRoomOf(): (projectId: string) => void {
  const { contacts, open } = useWorkspace();
  const [wanted, setWanted] = useState<string | null>(null);

  useEffect(() => {
    const contact = wanted && contacts.find((entry) => entry.project.id === wanted);
    if (!contact) return;

    setWanted(null);
    open({ kind: "room", conversationId: contact.chat.id });
  }, [wanted, contacts, open]);

  return setWanted;
}
