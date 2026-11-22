import { randomBytes } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * How the desktop app finds the sidecar: a small file in the data folder
 * holding the port it is listening on and the token every request must carry.
 * It is rewritten on every boot and readable only by you.
 */
export interface RuntimeInfo {
  port: number;
  token: string;
  pid: number;
}

export const RUNTIME_FILE = "sidecar.json";

export function newToken(): string {
  return randomBytes(32).toString("hex");
}

export function writeRuntimeFile(dataDir: string, info: RuntimeInfo): string {
  const path = join(dataDir, RUNTIME_FILE);
  writeFileSync(path, JSON.stringify(info, null, 2), { mode: 0o600 });
  return path;
}

export function removeRuntimeFile(dataDir: string): void {
  rmSync(join(dataDir, RUNTIME_FILE), { force: true });
}
