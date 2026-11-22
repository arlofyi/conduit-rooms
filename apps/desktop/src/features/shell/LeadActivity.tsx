import { Pulse, Spinner } from "@/components/ui";
import type { Contact } from "@/features/workspace/useWorkspace";

/** Shows that a lead is busy in a room you are not looking at (R-UI-05). */
export function LeadActivity({ contact }: { contact: Contact }) {
  switch (contact.chat.leadStatus) {
    case "speaking":
      return <Pulse />;
    case "joining":
      return <Spinner size={11} />;
    default:
      return null;
  }
}
