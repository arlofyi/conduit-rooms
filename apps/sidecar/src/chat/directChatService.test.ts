import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Project, WorkspaceEvent } from "@rooms/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { createSqliteLedger } from "../ledger/sqliteLedger";
import type { Ledger } from "../ledger/ledger";
import type { LeadRuntime, WakeEvent, WakeRequest } from "../leads/runtime";
import { openMemoryDb, type Db } from "../store/db";
import { ensureDirectChats, listDirectChats, type StoredDirectChat } from "../store/directChats";
import { listProjects, syncProjects } from "../store/projects";
import { createConversationBus } from "./conversationBus";
import { createDirectChatService, type DirectChatService } from "./directChatService";
import { createBriefs } from "../leads/briefs";
import { createLeadTurns } from "./leadTurns";

/** A runtime that replays a script per wake and records what it was asked. */
function scriptedRuntime(scripts: WakeEvent[][]) {
  const requests: WakeRequest[] = [];
  const gates: Array<() => void> = [];

  const runtime: LeadRuntime = {
    wake(request) {
      requests.push(request);
      const script = scripts.shift() ?? [{ type: "finished" }];
      let stopped = false;

      return {
        id: `wake_${requests.length}`,
        stop: () => {
          stopped = true;
          gates.shift()?.();
        },
        events: (async function* () {
          for (const event of script) {
            // "stopped" in a script means: wait here until stop() is called.
            if (event.type === "stopped") {
              await new Promise<void>((resolve) => gates.push(resolve));
              if (stopped) yield event;
              return;
            }
            yield event;
          }
        })(),
      };
    },
  };

  return { runtime, requests };
}

const BRIEF: WakeEvent[] = [{ type: "text", text: "# Arlo (arlo)\n\n## Purpose\nA test." }, { type: "finished" }];

let db: Db;
let ledger: Ledger;
let chat: StoredDirectChat;
let project: Project;
let events: WorkspaceEvent[];

function setup(scripts: WakeEvent[][]): { service: DirectChatService; requests: WakeRequest[] } {
  const { runtime, requests } = scriptedRuntime(scripts);
  const bus = createConversationBus();
  bus.subscribe((event) => events.push(event));
  const turns = createLeadTurns({ db, ledger, runtime, briefs: createBriefs({ db, ledger, runtime }), appTools: { for: () => [] }, bus });
  return { service: createDirectChatService({ db, bus, turns }), requests };
}

/** Resolves once the lead has settled back to idle or error. */
async function settled(service: DirectChatService): Promise<void> {
  for (let i = 0; i < 200; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    const status = service.leadStatus(chat);
    const busy = status === "joining" || status === "speaking";
    if (!busy && events.some((event) => event.type === "lead.status")) return;
  }
  throw new Error("The lead never settled.");
}

beforeEach(() => {
  db = openMemoryDb();
  ledger = createSqliteLedger(db);
  events = [];

  const repo = mkdtempSync(join(tmpdir(), "rooms-chat-"));
  syncProjects(db, [
    {
      id: "p1",
      name: "Arlo",
      path: repo,
      color: "#c4906c",
      activity: { projectId: "p1", status: "idle", sessions: [] },
      sessions: [],
    },
  ]);
  ensureDirectChats(db);
  project = listProjects(db)[0]!;
  chat = listDirectChats(db)[0]!;
});

describe("direct chat", () => {
  it("writes a first brief, then answers from it", async () => {
    const { service, requests } = setup([
      BRIEF,
      [{ type: "text", text: "The entry " }, { type: "text", text: "point is main.ts." }, { type: "finished" }],
    ]);

    service.send(chat, project, "What is the entry point?");
    await settled(service);

    expect(requests.map((request) => request.reason)).toEqual(["refresh_brief", "direct"]);
    expect(requests[1]!.systemPrompt).toContain("## Purpose\nA test.");
    expect(requests[1]!.prompt).toContain("You: What is the entry point?");

    const [yours, reply] = service.messages(chat);
    expect(yours).toMatchObject({ authorKind: "user", status: "complete" });
    expect(reply).toMatchObject({ authorKind: "lead", status: "complete", body: "The entry point is main.ts." });
    expect(ledger.readBrief(project.id)?.version).toBe(1);
  });

  it("announces each step, with offsets a late listener can line up", async () => {
    const { service } = setup([BRIEF, [{ type: "text", text: "Hello" }, { type: "text", text: " there" }, { type: "finished" }]]);

    service.send(chat, project, "Hi");
    await settled(service);

    expect(events.map((event) => event.type)).toEqual([
      "message.created", // yours
      "lead.status", // joining
      "message.created", // the reply, empty
      "lead.status", // speaking
      "message.delta",
      "message.delta",
      "message.settled",
      "lead.status", // listening
    ]);
    expect(events.filter((event) => event.type === "message.delta").map((event) => event.offset)).toEqual([0, 5]);
    expect(events.every((event) => event.conversationId === chat.id)).toBe(true);
  });

  it("skips the brief when one exists", async () => {
    ledger.writeBrief(project.id, "# Arlo (arlo)", "lead");
    const { service, requests } = setup([[{ type: "text", text: "Yes." }, { type: "finished" }]]);

    service.send(chat, project, "Still there?");
    await settled(service);

    expect(requests.map((request) => request.reason)).toEqual(["direct"]);
  });

  it("answers several quick messages with one reply", async () => {
    ledger.writeBrief(project.id, "# Arlo (arlo)", "lead");
    const { service, requests } = setup([
      [{ type: "text", text: "First." }, { type: "finished" }],
      [{ type: "text", text: "Both." }, { type: "finished" }],
    ]);

    service.send(chat, project, "One");
    service.send(chat, project, "Two");
    service.send(chat, project, "Three");
    await settled(service);

    // The first turn starts at once. The other two messages share the turn after it.
    expect(requests).toHaveLength(2);
    expect(requests[1]!.prompt).toContain("You: Three");
  });

  it("keeps the partial text when stopped", async () => {
    ledger.writeBrief(project.id, "# Arlo (arlo)", "lead");
    const { service } = setup([[{ type: "text", text: "Half an ans" }, { type: "stopped" }]]);

    service.send(chat, project, "Explain");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(service.messages(chat)[1]).toMatchObject({ status: "streaming", body: "Half an ans" });

    service.stop(chat);
    await settled(service);

    expect(service.messages(chat)[1]).toMatchObject({ status: "stopped", body: "Half an ans" });
    expect(service.leadStatus(chat)).toBe("listening");
  });

  it("records a failed reply and lets you retry it", async () => {
    ledger.writeBrief(project.id, "# Arlo (arlo)", "lead");
    const failure = { code: "runtime_error", message: "Claude is having trouble right now." } as const;
    const { service } = setup([
      [{ type: "failed", failure }],
      [{ type: "text", text: "Here now." }, { type: "finished" }],
    ]);

    service.send(chat, project, "Hello?");
    await settled(service);

    const failed = service.messages(chat)[1]!;
    expect(failed).toMatchObject({ status: "failed", failure });
    expect(service.leadStatus(chat)).toBe("error");

    events = [];
    service.rerun(chat, project, failed.id);
    await settled(service);

    expect(events[0]).toMatchObject({ type: "message.removed", messageId: failed.id });
    expect(service.messages(chat).map((message) => message.status)).toEqual(["complete", "complete"]);
  });

  it("reports a sign-in problem found while writing the brief", async () => {
    const failure = { code: "auth_required", message: "Leads are not signed in." } as const;
    const { service, requests } = setup([[{ type: "failed", failure }]]);

    service.send(chat, project, "Hello");
    await settled(service);

    expect(requests).toHaveLength(1);
    expect(service.messages(chat)[1]).toMatchObject({ authorKind: "lead", status: "failed", failure });
    expect(ledger.readBrief(project.id)).toBeNull();
  });
});
