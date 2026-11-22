/**
 * Schema history. Append a new entry to change the schema. Never edit one
 * that has shipped: a database remembers how many of these it has applied.
 *
 * Tables follow specs/10-data-model.md. The first group is the workspace
 * store, the second is the project ledger (specs/conflicts.md C5).
 */

/**
 * A migration is SQL. One that replaces a table with a new copy of itself
 * says so: SQLite only lets that happen with foreign keys switched off, and
 * db.ts checks every reference still holds before it commits.
 */
export type Migration = string | { rebuildsTables: true; sql: string };

export const migrations: readonly Migration[] = [
  `
  -- Workspace store ---------------------------------------------------------

  -- A cache of Conduit's project list, plus the handle Rooms assigns.
  CREATE TABLE projects (
    id            TEXT PRIMARY KEY,
    handle        TEXT NOT NULL UNIQUE,
    display_name  TEXT NOT NULL,
    repo_path     TEXT NOT NULL,
    color         TEXT NOT NULL,
    position      INTEGER NOT NULL,
    -- 0 once the project has been removed from Conduit. Its history is kept.
    present       INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE direct_chats (
    id                TEXT PRIMARY KEY,
    project_id        TEXT NOT NULL UNIQUE REFERENCES projects(id),
    last_activity_at  TEXT
  );

  CREATE TABLE messages (
    id                 TEXT PRIMARY KEY,
    conversation_id    TEXT NOT NULL,
    author_kind        TEXT NOT NULL CHECK (author_kind IN ('user', 'lead', 'system')),
    author_project_id  TEXT REFERENCES projects(id),
    body               TEXT NOT NULL,
    mentions           TEXT NOT NULL DEFAULT '[]',
    status             TEXT NOT NULL CHECK (status IN ('streaming', 'complete', 'stopped', 'failed')),
    wake_id            TEXT,
    wake_reason        TEXT,
    system_kind        TEXT,
    failure            TEXT,
    created_at         TEXT NOT NULL,
    edited_at          TEXT
  );

  -- Ids sort by creation time, so this one index serves "a conversation, in order".
  CREATE INDEX messages_by_conversation ON messages (conversation_id, id);

  CREATE TABLE drafts (
    conversation_id  TEXT PRIMARY KEY,
    body             TEXT NOT NULL,
    updated_at       TEXT NOT NULL
  );

  CREATE TABLE ui_state (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
  );

  -- Append-only. Never updated, never deleted (R-DATA-05).
  CREATE TABLE events (
    id               TEXT PRIMARY KEY,
    conversation_id  TEXT,
    at               TEXT NOT NULL,
    kind             TEXT NOT NULL,
    data             TEXT NOT NULL DEFAULT '{}'
  );

  CREATE INDEX events_by_conversation ON events (conversation_id, id);

  -- Project ledger -----------------------------------------------------------

  -- Every version of a brief is kept so a bad refresh can be undone (R-LEAD-10).
  CREATE TABLE briefs (
    project_id  TEXT NOT NULL REFERENCES projects(id),
    version     INTEGER NOT NULL,
    body        TEXT NOT NULL,
    written_at  TEXT NOT NULL,
    written_by  TEXT NOT NULL CHECK (written_by IN ('lead', 'user')),
    PRIMARY KEY (project_id, version)
  );
  `,

  `
  -- A project room is listed in the sidebar only once you add it.
  ALTER TABLE direct_chats ADD COLUMN added_at TEXT;

  -- Rooms you had already talked in stay listed.
  UPDATE direct_chats SET added_at = last_activity_at WHERE last_activity_at IS NOT NULL;
  `,

  `
  -- Common rooms: channels you create, each with the leads you chose for it.
  CREATE TABLE rooms (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE room_members (
    room_id     TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    project_id  TEXT NOT NULL REFERENCES projects(id),
    position    INTEGER NOT NULL,
    PRIMARY KEY (room_id, project_id)
  );

  -- "#projects" used to be built in, with every project that had a project
  -- room as a member. It becomes an ordinary room, keeping its id (so its
  -- messages stay with it) and the members it had at this moment.
  INSERT INTO rooms (id, name, created_at)
  VALUES ('chan_projects', 'projects', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

  INSERT INTO room_members (room_id, project_id, position)
  SELECT 'chan_projects', p.id, p.position
    FROM projects p
    JOIN direct_chats d ON d.project_id = p.id
   WHERE d.added_at IS NOT NULL AND p.present = 1;
  `,

  `
  -- Project ledger: the persona the gate reads. Every version is kept, like briefs.
  CREATE TABLE personas (
    project_id  TEXT NOT NULL REFERENCES projects(id),
    version     INTEGER NOT NULL,
    body        TEXT NOT NULL,
    written_at  TEXT NOT NULL,
    written_by  TEXT NOT NULL CHECK (written_by IN ('lead', 'user')),
    PRIMARY KEY (project_id, version)
  );
  `,

  `
  -- Hired agents: agents you make, that belong to no project. They live in the
  -- projects table so that everything keyed on a project (rooms, members,
  -- messages, handles, personas) works for them unchanged.
  ALTER TABLE projects ADD COLUMN kind TEXT NOT NULL DEFAULT 'project' CHECK (kind IN ('project', 'hired'));

  CREATE TABLE hired_agents (
    project_id    TEXT PRIMARY KEY REFERENCES projects(id),
    instructions  TEXT NOT NULL,
    hired_at      TEXT NOT NULL
  );
  `,

  {
    rebuildsTables: true,
    sql: `
  -- Products: several repos under one name, with a lead of their own.
  --
  -- A product is a third kind of row in projects. The old table only allowed
  -- two kinds, and SQLite cannot change a CHECK, so the table is rebuilt.
  -- The new one leaves the check out: kinds are a TypeScript union, and a
  -- check here would mean another rebuild the next time one is added.
  CREATE TABLE projects_next (
    id            TEXT PRIMARY KEY,
    kind          TEXT NOT NULL DEFAULT 'project',
    handle        TEXT NOT NULL UNIQUE,
    display_name  TEXT NOT NULL,
    -- Empty for a product and for a hired agent, which have no repo of their own.
    repo_path     TEXT NOT NULL,
    color         TEXT NOT NULL,
    position      INTEGER NOT NULL,
    present       INTEGER NOT NULL DEFAULT 1,
    -- For a repo: the product it is under, if any.
    product_id    TEXT REFERENCES projects(id)
  );

  INSERT INTO projects_next (id, kind, handle, display_name, repo_path, color, position, present)
  SELECT id, kind, handle, display_name, repo_path, color, position, present FROM projects;

  DROP TABLE projects;
  ALTER TABLE projects_next RENAME TO projects;

  CREATE TABLE products (
    project_id        TEXT PRIMARY KEY REFERENCES projects(id),
    created_at        TEXT NOT NULL,
    -- When its list of repos last changed. A product brief older than this is out of date.
    repos_changed_at  TEXT NOT NULL
  );
  `,
  },

  `
  -- What a lead looked up on the way to a reply, and how long the reply took.
  -- Both are null for every message written before this, and for messages a lead did not write.
  ALTER TABLE messages ADD COLUMN steps TEXT;
  ALTER TABLE messages ADD COLUMN took_ms INTEGER;
  `,

  `
  -- Pages agents write for you to open. Each belongs to the reply it was written with.
  CREATE TABLE artifacts (
    id               TEXT PRIMARY KEY,
    conversation_id  TEXT NOT NULL,
    message_id       TEXT NOT NULL,
    project_id       TEXT NOT NULL REFERENCES projects(id),
    title            TEXT NOT NULL,
    html             TEXT NOT NULL,
    created_at       TEXT NOT NULL
  );

  CREATE INDEX artifacts_by_conversation ON artifacts (conversation_id, id);
  `,
];
