import type { ProjectStatus } from "@rooms/shared";
import { groupByProduct } from "@/features/workspace/groupByProduct";
import { sortByRecentActivity } from "@/features/workspace/sortContacts";
import type { Contact } from "@/features/workspace/useWorkspace";

/**
 * Decides what the sidebar shows and in what order. Every project appears
 * once. What is busy comes first, what you talk to comes next, and what is
 * neither is folded away as quiet, so the list stays short however many
 * projects Conduit has.
 */

export interface ProjectEntry {
  kind: "project";
  contact: Contact;
  status: ProjectStatus;
}

export interface ProductEntry {
  kind: "product";
  contact: Contact;
  /** The most pressing status among its repos. */
  status: ProjectStatus;
  /** Repos that are busy or that you talk to, most pressing first. */
  repos: Contact[];
  /** The rest of its repos, shown only when asked for. */
  quietRepos: Contact[];
}

export type SidebarEntry = ProjectEntry | ProductEntry;

export interface SidebarArrangement {
  /** The agents you hired. They sit with your rooms, not with the projects. */
  agents: Contact[];
  entries: SidebarEntry[];
  /** Projects under no product that are idle and that you have never talked to. */
  quiet: Contact[];
}

export type StatusOf = (projectId: string) => ProjectStatus;

/** Lower comes first. */
const URGENCY: Record<ProjectStatus, number> = { needs_you: 0, working: 1, idle: 2 };

export function arrangeSidebar(contacts: readonly Contact[], statusOf: StatusOf): SidebarArrangement {
  const { products, loose, hired } = groupByProduct(contacts);
  const isKept = (contact: Contact) => statusOf(contact.project.id) !== "idle" || hasRoom(contact);
  const byUrgency = (a: Contact, b: Contact) => URGENCY[statusOf(a.project.id)] - URGENCY[statusOf(b.project.id)];

  const productEntries = products.map<ProductEntry>(({ product, repos }) => ({
    kind: "product",
    contact: product,
    status: mostPressing(repos.map((repo) => statusOf(repo.project.id))),
    repos: repos.filter(isKept).sort(byUrgency),
    quietRepos: repos.filter((repo) => !isKept(repo)),
  }));
  const projectEntries = loose
    .filter(isKept)
    .map<ProjectEntry>((contact) => ({ kind: "project", contact, status: statusOf(contact.project.id) }));

  // Recency first, then a stable sort by urgency, so entries of equal urgency stay in order of recency.
  const entryOf = new Map([...productEntries, ...projectEntries].map((entry) => [entry.contact, entry]));
  const entries = sortByRecentActivity([...entryOf.keys()])
    .map((contact) => entryOf.get(contact)!)
    .sort((a, b) => URGENCY[a.status] - URGENCY[b.status]);

  return { agents: hired, entries, quiet: loose.filter((contact) => !isKept(contact)) };
}

/** You have a room with a project once you added it or said something in it. */
function hasRoom({ chat }: Contact): boolean {
  return chat.addedAt !== null || chat.lastActivityAt !== null;
}

function mostPressing(statuses: readonly ProjectStatus[]): ProjectStatus {
  return statuses.reduce<ProjectStatus>((worst, status) => (URGENCY[status] < URGENCY[worst] ? status : worst), "idle");
}
