import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrations } from "./migrations";

export type Db = DatabaseSync;

/** Opens rooms.db, creating the folder and bringing the schema up to date. */
export function openDb(dataDir: string): Db {
  mkdirSync(dataDir, { recursive: true });
  return prepare(new DatabaseSync(join(dataDir, "rooms.db")));
}

/** A throwaway database for tests. */
export function openMemoryDb(): Db {
  return prepare(new DatabaseSync(":memory:"));
}

function prepare(db: Db): Db {
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);
  return db;
}

/** Applies every migration newer than the database's user_version, each in its own transaction. */
function migrate(db: Db): void {
  const { user_version: current } = db.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };

  for (const [index, migration] of migrations.entries()) {
    const version = index + 1;
    if (version <= current) continue;

    if (typeof migration === "string") {
      transaction(db, () => {
        db.exec(migration);
        db.exec(`PRAGMA user_version = ${version}`);
      });
    } else {
      rebuildTables(db, migration.sql, version);
    }
  }
}

/**
 * Runs a migration that replaces a table. Dropping a table that others point
 * at is refused while foreign keys are on, so they are off for exactly this
 * one transaction, which only commits if every reference still holds.
 */
function rebuildTables(db: Db, sql: string, version: number): void {
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    transaction(db, () => {
      db.exec(sql);

      const broken = db.prepare("PRAGMA foreign_key_check").all();
      if (broken.length > 0) {
        throw new Error(`Migration ${version} left ${broken.length} rows pointing at nothing.`);
      }
      db.exec(`PRAGMA user_version = ${version}`);
    });
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

/** Runs work inside a transaction and rolls back if it throws. */
export function transaction<T>(db: Db, work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
