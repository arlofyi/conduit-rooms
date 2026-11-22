import type { UiState } from "@rooms/shared";
import type { Db } from "./db";

const DEFAULTS: UiState = {
  lastView: null,
};

export function getUiState(db: Db): UiState {
  const rows = db.prepare("SELECT key, value FROM ui_state").all() as unknown as Array<{
    key: string;
    value: string;
  }>;

  const stored = Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value)]));
  return { ...DEFAULTS, ...stored };
}

export function saveUiState(db: Db, patch: Partial<UiState>): UiState {
  const upsert = db.prepare(
    `INSERT INTO ui_state (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
  );

  for (const [key, value] of Object.entries(patch)) {
    if (key in DEFAULTS) upsert.run(key, JSON.stringify(value));
  }

  return getUiState(db);
}
