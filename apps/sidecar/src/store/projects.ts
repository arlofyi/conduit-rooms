import { slugifyHandle, uniqueHandle, type Project } from "@rooms/shared";
import type { ConduitProject } from "../conduit/readProjects";
import { transaction, type Db } from "./db";

export interface ProjectRow {
  id: string;
  kind: Project["kind"];
  handle: string;
  display_name: string;
  repo_path: string;
  product_id: string | null;
  color: string;
}

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    kind: row.kind,
    handle: row.handle,
    displayName: row.display_name,
    // Only a project has a repo. The column is not nullable, so the others hold an empty string.
    repoPath: row.repo_path || null,
    productId: row.product_id,
    color: row.color,
  };
}

/**
 * Everyone you can talk to: Conduit's projects in Conduit's order, with the
 * products you made among them, then the agents you hired, oldest first.
 */
export function listProjects(db: Db): Project[] {
  const rows = db
    .prepare("SELECT * FROM projects WHERE present = 1 ORDER BY kind = 'hired', position")
    .all() as unknown as ProjectRow[];
  return rows.map(toProject);
}

export function getProject(db: Db, id: string): Project | null {
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as
    | ProjectRow
    | undefined;
  return row ? toProject(row) : null;
}

/**
 * Brings the cached project list in line with Conduit's.
 *
 * A new project gets a handle slugged from its name. A known project keeps
 * its handle even if it was renamed in Conduit, because the handle is what
 * you have been typing. A project gone from Conduit is hidden, not deleted,
 * so its conversations and ledger survive it coming back.
 */
export function syncProjects(db: Db, conduitProjects: readonly ConduitProject[]): void {
  transaction(db, () => {
    const known = db.prepare("SELECT id, handle FROM projects").all() as unknown as Array<
      Pick<ProjectRow, "id" | "handle">
    >;
    const handleById = new Map(known.map((row) => [row.id, row.handle]));
    const takenHandles = new Set(handleById.values());

    const insert = db.prepare(
      `INSERT INTO projects (id, handle, display_name, repo_path, color, position, present)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
    );
    const update = db.prepare(
      `UPDATE projects
          SET display_name = ?, repo_path = ?, color = ?, position = ?, present = 1
        WHERE id = ?`,
    );

    // Only projects come from Conduit. Products and hired agents are untouched by a sync.
    db.exec("UPDATE projects SET present = 0 WHERE kind = 'project'");

    conduitProjects.forEach((project, position) => {
      if (handleById.has(project.id)) {
        update.run(project.name, project.path, project.color, position, project.id);
        return;
      }

      const handle = uniqueHandle(slugifyHandle(project.name), takenHandles);
      takenHandles.add(handle);
      insert.run(project.id, handle, project.name, project.path, project.color, position);
    });
  });
}

export function isHandleTaken(db: Db, handle: string): boolean {
  return db.prepare("SELECT 1 FROM projects WHERE handle = ?").get(handle) !== undefined;
}

export function allHandles(db: Db): Set<string> {
  const rows = db.prepare("SELECT handle FROM projects").all() as unknown as Array<{ handle: string }>;
  return new Set(rows.map((row) => row.handle));
}

/**
 * Takes a product or a hired agent out of the workspace. It leaves the
 * sidebar and every room, and can no longer be tagged. Its messages stay
 * where they were said, under its name. Its handle is given back, so the
 * name can be used again. Returns false if there was nothing of that kind to retire.
 */
export function retire(db: Db, id: string, kind: Exclude<Project["kind"], "project">): boolean {
  const retired = db
    .prepare("UPDATE projects SET present = 0, handle = ? WHERE id = ? AND kind = ? AND present = 1")
    .run(retiredHandle(id), id, kind);
  if (retired.changes === 0) return false;

  db.prepare("DELETE FROM room_members WHERE project_id = ?").run(id);
  return true;
}

/** A handle nobody will type: it only has to be unique and leave the real one free. */
function retiredHandle(id: string): string {
  return `gone-${id.slice(-20)}`;
}

/** The position a newly made product or agent takes: after everything there is. */
export function nextPosition(db: Db): number {
  const { next } = db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS next FROM projects").get() as {
    next: number;
  };
  return next;
}
