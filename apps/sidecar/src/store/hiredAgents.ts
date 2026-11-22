import { newId, slugifyHandle, uniqueHandle, type HiredAgent, type Project } from "@rooms/shared";
import { projectAccent } from "../conduit/projectColor";
import { transaction, type Db } from "./db";
import { allHandles, getProject, nextPosition, retire } from "./projects";

/**
 * Agents you hire. Each one is a row in `projects` with kind "hired", plus
 * the instructions you gave it here. See the note on `Project` in
 * packages/shared for why they share a table with projects.
 */

interface HiredAgentRow {
  project_id: string;
  instructions: string;
  hired_at: string;
}

function toHiredAgent(row: HiredAgentRow): HiredAgent {
  return { projectId: row.project_id, instructions: row.instructions, hiredAt: row.hired_at };
}

export function getHiredAgent(db: Db, projectId: string): HiredAgent | null {
  const row = db.prepare("SELECT * FROM hired_agents WHERE project_id = ?").get(projectId) as
    | HiredAgentRow
    | undefined;
  return row ? toHiredAgent(row) : null;
}

/** Hires an agent. Its handle is slugged from its name: "Head of Research" becomes "head-of-research". */
export function hireAgent(db: Db, name: string, instructions: string): { agent: Project; hired: HiredAgent } {
  const id = newId("agent");
  const hired: HiredAgent = { projectId: id, instructions, hiredAt: new Date().toISOString() };

  transaction(db, () => {
    const handle = uniqueHandle(slugifyHandle(name), allHandles(db));
    db.prepare(
      `INSERT INTO projects (id, kind, handle, display_name, repo_path, color, position, present)
       VALUES (?, 'hired', ?, ?, '', ?, ?, 1)`,
    ).run(id, handle, name, projectAccent(id), nextPosition(db));

    db.prepare("INSERT INTO hired_agents (project_id, instructions, hired_at) VALUES (?, ?, ?)").run(
      hired.projectId,
      hired.instructions,
      hired.hiredAt,
    );
  });

  return { agent: getProject(db, id)!, hired };
}

export function updateInstructions(db: Db, projectId: string, instructions: string): void {
  db.prepare("UPDATE hired_agents SET instructions = ? WHERE project_id = ?").run(instructions, projectId);
}

/**
 * Lets an agent go. It disappears from the sidebar and from every room, and
 * can no longer be tagged. Its messages stay where they were said, under its
 * name. Its handle is given back, so you can hire another "@cto" later.
 */
export function dismissAgent(db: Db, projectId: string): void {
  transaction(db, () => retire(db, projectId, "hired"));
}
