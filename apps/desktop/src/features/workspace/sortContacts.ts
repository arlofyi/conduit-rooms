import type { Contact } from "./useWorkspace";

/**
 * The order of the Direct section (R-UI-04): most recent message first, then
 * the projects never messaged, alphabetically by handle.
 */
export function sortByRecentActivity(contacts: readonly Contact[]): Contact[] {
  return [...contacts].sort((a, b) => {
    const aTime = a.chat.lastActivityAt;
    const bTime = b.chat.lastActivityAt;

    if (aTime && bTime) return aTime < bTime ? 1 : -1;
    if (aTime) return -1;
    if (bTime) return 1;
    return a.project.handle.localeCompare(b.project.handle);
  });
}
