import type { Contact } from "./useWorkspace";

/** A product with the repos you put under it, in Conduit's order. */
export interface ProductGroup {
  product: Contact;
  repos: Contact[];
}

export interface GroupedContacts {
  /** The products you made, oldest first. */
  products: ProductGroup[];
  /** Projects that are under no product. */
  loose: Contact[];
  /** The agents you hired. */
  hired: Contact[];
}

/**
 * Sorts everyone you can talk to into the three shapes the sidebar draws.
 * A repo whose product is gone from the list is treated as loose, so it can
 * never fall out of sight.
 */
export function groupByProduct(contacts: readonly Contact[]): GroupedContacts {
  const groups = new Map<string, ProductGroup>();
  for (const contact of contacts) {
    if (contact.project.kind === "product") groups.set(contact.project.id, { product: contact, repos: [] });
  }

  const loose: Contact[] = [];
  const hired: Contact[] = [];

  for (const contact of contacts) {
    const { kind, productId } = contact.project;
    if (kind === "hired") hired.push(contact);
    if (kind !== "project") continue;

    const group = productId ? groups.get(productId) : undefined;
    if (group) group.repos.push(contact);
    else loose.push(contact);
  }

  return { products: [...groups.values()], loose, hired };
}
