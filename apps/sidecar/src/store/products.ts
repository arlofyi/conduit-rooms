import { newId, type Project } from "@rooms/shared";
import { projectAccent } from "../conduit/projectColor";
import { transaction, type Db } from "./db";
import { getProject, nextPosition, retire, toProject, type ProjectRow } from "./projects";

/**
 * Products: several repos under one name. Each is a row in `projects` with
 * kind "product", and the repos under it carry its id in `product_id`. A repo
 * is under one product at most. See the note on `Project` in packages/shared.
 */

/** Makes a product over these repos. The caller has already checked the handle is free. */
export function createProduct(db: Db, name: string, handle: string, repoIds: readonly string[]): Project {
  const id = newId("product");
  const now = new Date().toISOString();

  transaction(db, () => {
    db.prepare(
      `INSERT INTO projects (id, kind, handle, display_name, repo_path, color, position, present)
       VALUES (?, 'product', ?, ?, '', ?, ?, 1)`,
    ).run(id, handle, name, projectAccent(id), nextPosition(db));

    db.prepare("INSERT INTO products (project_id, created_at, repos_changed_at) VALUES (?, ?, ?)").run(id, now, now);
    assignRepos(db, id, repoIds);
  });

  return getProject(db, id)!;
}

export function renameProduct(db: Db, productId: string, name: string): void {
  db.prepare("UPDATE projects SET display_name = ? WHERE id = ? AND kind = 'product'").run(name, productId);
}

/** Sets the repos under a product to exactly this list. A repo taken from another product moves here. */
export function setProductRepos(db: Db, productId: string, repoIds: readonly string[]): void {
  transaction(db, () => {
    db.prepare("UPDATE projects SET product_id = NULL WHERE product_id = ?").run(productId);
    assignRepos(db, productId, repoIds);
  });
}

function assignRepos(db: Db, productId: string, repoIds: readonly string[]): void {
  const assign = db.prepare("UPDATE projects SET product_id = ? WHERE id = ? AND kind = 'project'");
  const touch = db.prepare("UPDATE products SET repos_changed_at = ? WHERE project_id = ?");
  const now = new Date().toISOString();

  // A product that loses a repo to this one has changed as well.
  const losing = db.prepare("SELECT product_id FROM projects WHERE id = ? AND product_id IS NOT NULL");

  for (const repoId of new Set(repoIds)) {
    const previous = losing.get(repoId) as { product_id: string } | undefined;
    if (previous) touch.run(now, previous.product_id);
    assign.run(productId, repoId);
  }
  touch.run(now, productId);
}

/** The repos under a product that are still in Conduit, in Conduit's order. */
export function listProductRepos(db: Db, productId: string): Project[] {
  const rows = db
    .prepare("SELECT * FROM projects WHERE product_id = ? AND present = 1 ORDER BY position")
    .all(productId) as unknown as ProjectRow[];
  return rows.map(toProject);
}

/** When the product's list of repos last changed, or null if there is no such product. */
export function reposChangedAt(db: Db, productId: string): string | null {
  const row = db.prepare("SELECT repos_changed_at FROM products WHERE project_id = ?").get(productId) as
    | { repos_changed_at: string }
    | undefined;
  return row?.repos_changed_at ?? null;
}

/**
 * Takes a product apart. Its repos go back to standing on their own, each
 * with the lead and the room it always had. The product's own room leaves the
 * sidebar, and what was said in it is kept.
 */
export function removeProduct(db: Db, productId: string): void {
  transaction(db, () => {
    if (!retire(db, productId, "product")) return;
    db.prepare("UPDATE projects SET product_id = NULL WHERE product_id = ?").run(productId);
  });
}
