import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { WorkspaceEvent } from "@rooms/shared";
import { createConversationBus } from "../chat/conversationBus";
import { SessionNotStartedError, type NewSession } from "../conduit/startSession";
import { createSqliteLedger } from "../ledger/sqliteLedger";
import { getArtifact, listArtifacts } from "../store/artifacts";
import { openMemoryDb } from "../store/db";
import { hireAgent } from "../store/hiredAgents";
import { createProduct } from "../store/products";
import { getProject, syncProjects } from "../store/projects";
import { BRIEFS_PER_CALL, createAppTools } from "./appTools";
import { createBriefs } from "./briefs";
import { allowingAppTools, createWebGuard } from "./repoGuard";
import type { AppTool, LeadRuntime, WakeRequest } from "./runtime";

function setup() {
  const db = openMemoryDb();
  const ledger = createSqliteLedger(db);
  const requests: WakeRequest[] = [];

  /** A brief wake answers with a brief. Any other wake answers with who it is. */
  const runtime: LeadRuntime = {
    wake(request) {
      requests.push(request);
      const text =
        request.reason === "refresh_brief"
          ? `# ${request.project.displayName}\n\n## Purpose\nBrief of ${request.project.handle}.`
          : `${request.project.handle} says 8530.`;

      return {
        id: `wake_${requests.length}`,
        stop: () => undefined,
        events: (async function* () {
          yield { type: "text" as const, text };
          yield { type: "finished" as const };
        })(),
      };
    },
  };

  const repo = (id: string, name: string) => ({
    id,
    name,
    path: mkdtempSync(join(tmpdir(), `rooms-tools-${id}-`)),
    color: "#c4906c",
    activity: { projectId: id, status: "idle" as const, sessions: [] },
    sessions: [],
  });
  syncProjects(db, [repo("p1", "arlo"), repo("p2", "lavvo")]);
  ledger.writeBrief("p1", "# arlo\n\n## Purpose\nThe whole arlo brief.", "lead");

  // Conduit's state as it would be on disk: arlo has one session waiting on you.
  const conduitDataDir = mkdtempSync(join(tmpdir(), "rooms-tools-conduit-"));
  writeFileSync(
    join(conduitDataDir, "state.json"),
    JSON.stringify({
      projects: [
        { id: "p1", name: "arlo", path: "/p1", sessions: [{ id: "s1", name: "Fix login", agent: "claude", agentState: "needsInput" }] },
        { id: "p2", name: "lavvo", path: "/p2", sessions: [] },
      ],
    }),
  );

  const briefs = createBriefs({ db, ledger, runtime });
  const bus = createConversationBus();
  const events: WorkspaceEvent[] = [];
  bus.subscribe((event) => events.push(event));
  const started: NewSession[] = [];
  const startSession = async (session: NewSession) => {
    if (session.name === "Conduit is closed") throw new SessionNotStartedError("Conduit is not running.");
    started.push(session);
  };
  const appTools = createAppTools({ db, ledger, runtime, briefs, bus, conduitDataDir, startSession });
  const { agent } = hireAgent(db, "Strategist", "Think ahead.");

  const toolOf = (speaker: typeof agent, name: string): AppTool => {
    const found = appTools.for(speaker).find((tool) => tool.name === name);
    if (!found) throw new Error(`${speaker.handle} has no ${name}`);
    return found;
  };

  return { db, ledger, requests, appTools, agent, toolOf, events, started };
}

const names = (tools: AppTool[]) => tools.map((tool) => tool.name).sort();

describe("who gets which app tools", () => {
  it("gives a hired agent and a product's lead all four", () => {
    const { db, appTools, agent } = setup();
    const product = createProduct(db, "Arlo", "arlo-product", ["p1"]);
    const all = ["ask_lead", "list_sessions", "read_brief", "start_session", "write_briefs"];

    expect(names(appTools.for(agent))).toEqual(all);
    expect(names(appTools.for(product))).toEqual(all);
  });

  it("gives a project's lead only its own sessions", () => {
    const { db, appTools } = setup();
    expect(names(appTools.for(getProject(db, "p1")!))).toEqual(["list_sessions", "start_session"]);
  });
});

describe("ask_lead", () => {
  it("wakes the lead with the question and brings back its answer", async () => {
    const { requests, agent, toolOf } = setup();
    const answer = await toolOf(agent, "ask_lead").run({ handle: "arlo", question: "Which port?" });

    expect(answer).toBe("arlo says 8530.");
    expect(requests.at(-1)).toMatchObject({ project: { handle: "arlo" }, reason: "addressed_by_lead" });
    expect(requests.at(-1)!.prompt).toContain("Which port?");
  });

  it("gives the lead it asks no app tools, so it cannot ask onward", async () => {
    const { requests, agent, toolOf } = setup();
    await toolOf(agent, "ask_lead").run({ handle: "arlo", question: "Which port?" });

    expect(requests.at(-1)!.appTools ?? []).toEqual([]);
  });

  it("has a lead with no brief write one before it answers", async () => {
    const { requests, agent, toolOf } = setup();
    await toolOf(agent, "ask_lead").run({ handle: "@lavvo", question: "What are you?" });

    expect(requests.map((request) => request.reason)).toEqual(["refresh_brief", "addressed_by_lead"]);
  });

  it("answers with the reason, instead of failing, when there is no such lead", async () => {
    const { requests, agent, toolOf } = setup();

    expect(await toolOf(agent, "ask_lead").run({ handle: "nope", question: "Hello?" })).toBe(
      "There is no project or product called @nope.",
    );
    expect(await toolOf(agent, "ask_lead").run({ handle: "strategist", question: "Hello?" })).toContain("no project");
    expect(requests).toHaveLength(0);
  });
});

describe("read_brief", () => {
  it("returns the whole brief, or says there is none yet", async () => {
    const { agent, toolOf } = setup();

    expect(await toolOf(agent, "read_brief").run({ handle: "arlo" })).toContain("The whole arlo brief.");
    expect(await toolOf(agent, "read_brief").run({ handle: "lavvo" })).toContain("no brief yet");
  });
});

describe("write_briefs", () => {
  it("starts only the briefs that are missing, and returns before they are written", async () => {
    const { ledger, agent, toolOf } = setup();
    const told = await toolOf(agent, "write_briefs").run({ handles: ["arlo", "lavvo"] });

    expect(told).toContain("Started: @lavvo.");
    expect(told).toContain("Already have a brief: @arlo.");

    // It was only started. The brief is not there the moment the tool returns, and arrives on its own.
    expect(ledger.readBrief("p2")).toBeNull();
    await expect.poll(() => ledger.readBrief("p2")?.body).toContain("Brief of lavvo.");
  });

  it("refuses more projects than one call may start", async () => {
    const { requests, agent, toolOf } = setup();
    const tooMany = Array.from({ length: BRIEFS_PER_CALL + 1 }, () => "lavvo");

    expect(await toolOf(agent, "write_briefs").run({ handles: tooMany })).toContain(`${BRIEFS_PER_CALL} at most`);
    expect(requests).toHaveLength(0);
  });
});

describe("list_sessions", () => {
  it("says what Conduit is running in a project, and how each session stands", async () => {
    const { db, agent, toolOf } = setup();

    expect(await toolOf(agent, "list_sessions").run({ handle: "arlo" })).toBe('- arlo: "Fix login" (claude, needs you)');
    expect(await toolOf(getProject(db, "p1")!, "list_sessions").run({})).toContain("Fix login");
    expect(await toolOf(agent, "list_sessions").run({ handle: "lavvo" })).toBe("Conduit is running no sessions in @lavvo.");
  });
});

describe("start_session", () => {
  const brief = "Add a Google Play link beside the App Store link in site/src/lib/app.ts.";

  it("starts a session in a project lead's own repo, with the brief it wrote", async () => {
    const { db, toolOf, started } = setup();
    const arlo = getProject(db, "p1")!;

    const told = await toolOf(arlo, "start_session").run({ name: "Add Play links", brief });

    expect(started).toEqual([{ repoPath: arlo.repoPath, name: "Add Play links", brief, worktree: undefined }]);
    expect(told).toContain('Started "Add Play links" in @arlo');
  });

  it("gives the session a branch of its own when asked, named from the session", async () => {
    const { db, toolOf, started } = setup();
    await toolOf(getProject(db, "p1")!, "start_session").run({ name: "Rework Auth!", brief, own_branch: true });

    expect(started[0]!.worktree).toBe("rework-auth");
  });

  it("lets a hired agent start one in any project, and a product's lead only in its own repos", async () => {
    const { db, agent, toolOf, started } = setup();
    const product = createProduct(db, "Arlo", "arlo-product", ["p1"]);

    await toolOf(agent, "start_session").run({ handle: "lavvo", name: "Tidy up", brief });
    await toolOf(product, "start_session").run({ handle: "arlo", name: "Tidy up", brief });
    const refused = await toolOf(product, "start_session").run({ handle: "lavvo", name: "Tidy up", brief });

    expect(started.map((session) => session.repoPath)).toEqual([getProject(db, "p2")!.repoPath, getProject(db, "p1")!.repoPath]);
    expect(refused).toContain("cannot start a session in @lavvo");
  });

  it("starts no more than three in one reply", async () => {
    const { db, toolOf, started } = setup();
    const start = toolOf(getProject(db, "p1")!, "start_session");

    for (const name of ["One", "Two", "Three"]) await start.run({ name: `${name} thing`, brief });
    const fourth = await start.run({ name: "Four thing", brief });

    expect(started).toHaveLength(3);
    expect(fourth).toContain("the most one reply may start");
  });

  it("says why, instead of failing the reply, when Conduit cannot start it", async () => {
    const { db, toolOf } = setup();
    const told = await toolOf(getProject(db, "p1")!, "start_session").run({ name: "Conduit is closed", brief });

    expect(told).toBe("The session was not started. Conduit is not running.");
  });
});

describe("write_artifact", () => {
  const page = "<!doctype html><title>Plan</title><h1>Release plan</h1>";

  it("is offered only while a reply is being written", () => {
    const { db, appTools, agent } = setup();
    const reply = { conversationId: "room_1", messageId: "msg_1" };

    expect(names(appTools.for(agent))).not.toContain("write_artifact");
    expect(names(appTools.for(agent, reply))).toContain("write_artifact");
    expect(names(appTools.for(getProject(db, "p1")!, reply))).toEqual(["list_sessions", "start_session", "write_artifact"]);
  });

  it("saves the page with the reply it came with, and announces it", async () => {
    const { db, appTools, agent, events } = setup();
    const reply = { conversationId: "room_1", messageId: "msg_1" };
    const tool = appTools.for(agent, reply).find((candidate) => candidate.name === "write_artifact")!;

    const told = await tool.run({ title: "Release plan", html: page });

    const [saved] = listArtifacts(db, "room_1");
    expect(saved).toMatchObject({ title: "Release plan", messageId: "msg_1", projectId: agent.id });
    expect(getArtifact(db, saved!.id)?.html).toBe(page);
    expect(events).toMatchObject([{ type: "artifact.created", conversationId: "room_1", artifact: { id: saved!.id } }]);
    expect(told).toContain('Saved "Release plan"');
  });

  it("says so, and saves nothing, when the reply has no id yet", async () => {
    const { db, appTools, agent } = setup();
    const tool = appTools.for(agent, { conversationId: "room_1", messageId: null }).find(
      (candidate) => candidate.name === "write_artifact",
    )!;

    expect(await tool.run({ title: "Release plan", html: page })).toContain("no reply to attach");
    expect(listArtifacts(db, "room_1")).toEqual([]);
  });
});

describe("allowingAppTools", () => {
  it("lets the named app tools through up to their own budget, and leaves the rest to the inner guard", () => {
    const guard = allowingAppTools(createWebGuard(1), ["mcp__rooms__ask_lead"], 2);

    expect(guard.check("mcp__rooms__ask_lead", {}).allow).toBe(true);
    expect(guard.check("mcp__rooms__ask_lead", {}).allow).toBe(true);
    expect(guard.check("mcp__rooms__ask_lead", {})).toMatchObject({ allow: false });

    expect(guard.check("WebSearch", { query: "x" }).allow).toBe(true);
    expect(guard.check("mcp__rooms__write_briefs", {}).allow).toBe(false);
    expect(guard.check("Read", { file_path: "/etc/hosts" }).allow).toBe(false);
  });
});
