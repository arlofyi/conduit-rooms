import { MENTION_ALL } from "@rooms/shared";
import { useMemo } from "react";
import { useWorkspace } from "./useWorkspace";

/** Every handle that draws as a mention pill: each project's, and "all". */
export function useKnownHandles(): ReadonlySet<string> {
  const { contacts } = useWorkspace();
  return useMemo(() => new Set([MENTION_ALL, ...contacts.map((contact) => contact.project.handle)]), [contacts]);
}
