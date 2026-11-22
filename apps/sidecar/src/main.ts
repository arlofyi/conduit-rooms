import { createChannelService } from "./chat/channelService";
import { createConversationBus } from "./chat/conversationBus";
import { createDirectChatService } from "./chat/directChatService";
import { createLeadTurns } from "./chat/leadTurns";
import { conduitSessionStarter } from "./conduit/startSession";
import { loadConfig } from "./config";
import { createApp, listen } from "./http/server";
import { createSqliteLedger } from "./ledger/sqliteLedger";
import { createAgentSdkRuntime } from "./leads/agentSdkRuntime";
import { createAppTools } from "./leads/appTools";
import { createBriefs } from "./leads/briefs";
import type { Gate } from "./leads/gate";
import { createJevGate } from "./leads/jevGate";
import { createOllamaGate } from "./leads/ollamaGate";
import { createPersonas } from "./leads/personas";
import { newToken, removeRuntimeFile, writeRuntimeFile } from "./runtimeFile";
import { openDb } from "./store/db";
import { getHiredAgent } from "./store/hiredAgents";
import { closeInterruptedMessages } from "./store/messages";

/**
 * The sidecar: the Node process behind the desktop app. It owns the database,
 * the project ledger and every lead wake. The app only ever talks to it over
 * HTTP, so this file is the whole wiring diagram.
 */
async function main(): Promise<void> {
  const config = loadConfig();

  const db = openDb(config.dataDir);
  const interrupted = closeInterruptedMessages(db);
  if (interrupted > 0) console.log(`[sidecar] closed ${interrupted} unfinished replies left by the last quit`);

  const ledger = createSqliteLedger(db);
  const runtime = createAgentSdkRuntime();
  const bus = createConversationBus();
  const briefs = createBriefs({ db, ledger, runtime });
  const appTools = createAppTools({
    db,
    ledger,
    runtime,
    briefs,
    bus,
    conduitDataDir: config.conduitDataDir,
    startSession: conduitSessionStarter(config.conduitDataDir),
  });
  const turns = createLeadTurns({ db, ledger, runtime, briefs, appTools, bus });
  const directChats = createDirectChatService({ db, bus, turns });
  const personas = createPersonas({
    db,
    ledger,
    runtime,
    briefs,
    instructionsOf: (projectId) => getHiredAgent(db, projectId)?.instructions ?? null,
  });

  // Jev when its key is set: built for classifying, and faster. Otherwise the local model.
  const gate = config.gate.jevKey ? createJevGate(config.gate.jevKey) : createOllamaGate(config.gate);
  const gateName = config.gate.jevKey ? "Jev" : config.gate.model;
  const channels = createChannelService({ db, ledger, bus, turns, gate, personas });
  void warmGate(gate, gateName);

  const token = newToken();
  const app = createApp({ config, db, ledger, runtime, bus, directChats, channels, personas, token });
  const server = await listen(app, config.port);

  writeRuntimeFile(config.dataDir, { port: config.port, token, pid: process.pid });
  console.log(`[sidecar] listening on 127.0.0.1:${config.port}, leads sign in with ${config.leadAuth}`);

  const shutdown = () => {
    removeRuntimeFile(config.dataDir);
    server.close();
    db.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

/**
 * Loads the gate's model into memory at boot. The first call to a cold model
 * takes several seconds, and that wait should not land on your first message.
 */
async function warmGate(gate: Gate, name: string): Promise<void> {
  const project = { id: "warm", kind: "project" as const, handle: "warm", displayName: "Warm", repoPath: "/", productId: null, color: "" };
  const { unavailable, reason, latencyMs } = await gate.decide({
    roomName: "warm-up",
    members: [{ project, persona: null }],
    recent: [],
    message: "hello",
  });

  console.log(
    unavailable
      ? `[sidecar] gate (${name}) is not reachable: ${reason}. Untagged messages will ask you to use @.`
      : `[sidecar] gate (${name}) is ready, warmed in ${latencyMs}ms`,
  );
}

main().catch((error) => {
  console.error("[sidecar] failed to start:", error);
  process.exit(1);
});
