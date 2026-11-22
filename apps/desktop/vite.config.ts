import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { ProxyOptions } from "vite";
import { defineConfig } from "vitest/config";

/**
 * In development the app never talks to the sidecar directly. It calls /api
 * on its own origin and this proxy forwards the call, adding the sidecar's
 * token. The token is read from the sidecar's runtime file on every request,
 * because the sidecar mints a new one each time it starts.
 */
const DATA_DIR =
  process.env.ROOMS_DATA_DIR || join(homedir(), "Library", "Application Support", "ConduitRooms");

const SIDECAR_PORT = Number(process.env.ROOMS_SIDECAR_PORT || 8530);

function readSidecarToken(): string | null {
  const path = join(DATA_DIR, "sidecar.json");
  if (!existsSync(path)) return null;
  return (JSON.parse(readFileSync(path, "utf8")) as { token: string }).token;
}

const sidecarProxy: ProxyOptions = {
  target: `http://127.0.0.1:${SIDECAR_PORT}`,
  configure(proxy) {
    proxy.on("proxyReq", (proxyReq) => {
      const token = readSidecarToken();
      if (token) proxyReq.setHeader("x-rooms-token", token);
    });
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // Tauri expects a fixed port and reads compiler errors from this terminal.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    proxy: { "/api": sidecarProxy },
    watch: { ignored: ["**/src-tauri/**"] },
  },
  test: {
    environment: "happy-dom",
  },
});
