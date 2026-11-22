import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_GATE_MODEL } from "./leads/ollamaGate";

/** Everything the sidecar reads from its environment, resolved once at boot. */
export interface Config {
  /** Where Rooms keeps rooms.db and its runtime file. */
  dataDir: string;
  /** Where Conduit keeps state.json. Read only. */
  conduitDataDir: string;
  /** The port the HTTP API listens on, on 127.0.0.1 only. */
  port: number;
  /** Browser origins allowed to call the API. */
  allowedOrigins: string[];
  /** How leads authenticate. Without a key, the Agent SDK uses the local Claude Code login. */
  leadAuth: "api_key" | "claude_login";
  /**
   * The gate: what decides who an untagged message is for. Jev (TypeSafe's
   * classifier) when its key is set, otherwise a local model served by Ollama.
   */
  gate: { jevKey: string | null; url: string; model: string };
}

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../../..");
const APP_SUPPORT = join(homedir(), "Library", "Application Support");
const DEFAULT_PORT = 8530;

function loadEnvFile(): void {
  const path = join(REPO_ROOT, ".env.local");
  if (existsSync(path)) process.loadEnvFile(path);
}

/** Treats an empty value the same as an unset one, so a blank line in .env.local is harmless. */
function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function loadConfig(): Config {
  loadEnvFile();

  // An empty key would make the SDK try it and fail, instead of falling back to the login.
  if (!env("ANTHROPIC_API_KEY")) delete process.env.ANTHROPIC_API_KEY;

  return {
    dataDir: env("ROOMS_DATA_DIR") ?? join(APP_SUPPORT, "ConduitRooms"),
    conduitDataDir: env("CONDUIT_DATA_DIR") ?? join(APP_SUPPORT, "ConduitTauri"),
    port: Number(env("ROOMS_SIDECAR_PORT") ?? DEFAULT_PORT),
    allowedOrigins: [
      "http://localhost:1420",
      "http://127.0.0.1:1420",
      "tauri://localhost",
    ],
    leadAuth: env("ANTHROPIC_API_KEY") ? "api_key" : "claude_login",
    gate: {
      jevKey: env("TYPESAFE_API_KEY") ?? null,
      url: env("ROOMS_GATE_URL") ?? "http://127.0.0.1:11434",
      model: env("ROOMS_GATE_MODEL") ?? DEFAULT_GATE_MODEL,
    },
  };
}
