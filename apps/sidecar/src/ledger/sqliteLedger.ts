import type { Brief, Persona } from "@rooms/shared";
import type { Db } from "../store/db";
import { BRIEF_MAX_CHARS, BriefTooLongError, type Ledger } from "./ledger";

interface BriefRow {
  project_id: string;
  version: number;
  body: string;
  written_at: string;
  written_by: Brief["writtenBy"];
}

function toBrief(row: BriefRow): Brief {
  return {
    projectId: row.project_id,
    version: row.version,
    body: row.body,
    writtenAt: row.written_at,
    writtenBy: row.written_by,
  };
}

/** Briefs and personas are stored the same way: one row per version, the highest version current. */
function toVersioned(row: BriefRow): Brief & Persona {
  return toBrief(row);
}

/** The ledger kept in Rooms' own database (specs/conflicts.md C5). */
export function createSqliteLedger(db: Db): Ledger {
  return {
    readBrief(projectId) {
      const row = db
        .prepare("SELECT * FROM briefs WHERE project_id = ? ORDER BY version DESC LIMIT 1")
        .get(projectId) as BriefRow | undefined;
      return row ? toBrief(row) : null;
    },

    writeBrief(projectId, body, writtenBy) {
      if (body.length > BRIEF_MAX_CHARS) throw new BriefTooLongError(body.length);

      const brief: Brief = {
        projectId,
        version: (this.readBrief(projectId)?.version ?? 0) + 1,
        body,
        writtenAt: new Date().toISOString(),
        writtenBy,
      };

      db.prepare(
        "INSERT INTO briefs (project_id, version, body, written_at, written_by) VALUES (?, ?, ?, ?, ?)",
      ).run(brief.projectId, brief.version, brief.body, brief.writtenAt, brief.writtenBy);

      return brief;
    },

    readPersona(projectId) {
      const row = db
        .prepare("SELECT * FROM personas WHERE project_id = ? ORDER BY version DESC LIMIT 1")
        .get(projectId) as BriefRow | undefined;
      return row ? toVersioned(row) : null;
    },

    writePersona(projectId, body, writtenBy) {
      const persona: Persona = {
        projectId,
        version: (this.readPersona(projectId)?.version ?? 0) + 1,
        body,
        writtenAt: new Date().toISOString(),
        writtenBy,
      };

      db.prepare(
        "INSERT INTO personas (project_id, version, body, written_at, written_by) VALUES (?, ?, ?, ?, ?)",
      ).run(persona.projectId, persona.version, persona.body, persona.writtenAt, persona.writtenBy);

      return persona;
    },
  };
}
