import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Project } from "@rooms/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { createSqliteLedger } from "../ledger/sqliteLedger";
import type { LeadRuntime, WakeRequest } from "../leads/runtime";
import { openMemoryDb, type Db } from "../store/db";
import { listProjects, syncProjects } from "../store/projects";
import type { Gate, GateQuestion } from "../leads/gate";
import {
  createChannelService,
  leadSpokenTo,
  namedMembers,
  taggedMembers,
  type ChannelService,
} from "./channelService";
import { createConversationBus } from "./conversationBus";
import { createBriefs } from "../leads/briefs";
import { createLeadTurns } from "./leadTurns";

const room = { id: "room_test", name: "plugins", createdAt: "2026-11-21T00:00:00.000Z" };

let db: Db;
let members: Project[];
let requests: WakeRequest[];
let service: ChannelService;
let gateQuestions: GateQuestion[];
/** Which handles the fake gate says should speak. "down" makes it unreachable. */
let gateSays: string[] | "down";

const fakeGate: Gate = {
  async decide(question) {
    gateQuestions.push(question);
    if (gateSays === "down") {
      return { speakers: [], reason: "connection refused", latencyMs: 1, unavailable: true };
    }

    const speakers = question.members
      .map((member) => member.project)
      .filter((project) => gateSays.includes(project.handle));
    return { speakers, reason: "test", latencyMs: 1, unavailable: false };
  },
};

/** Every lead answers with its own handle, so the transcript shows who spoke and in what order. */
const echoRuntime: LeadRuntime = {
  wake(request) {
    requests.push(request);
    return {
      id: `wake_${requests.length}`,
      stop: () => undefined,
      events: (async function* () {
        yield { type: "text" as const, text: `${request.project.handle} here.` };
        yield { type: "finished" as const };
      })(),
    };
  },
};

async function idle(): Promise<void> {
  for (let i = 0; i < 200; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    const speaking = service.messages(room).some((message) => message.status === "streaming");
    const answered = service.messages(room).filter((message) => message.authorKind === "lead").length;
    if (!speaking && answered === requests.length) return;
  }
}

beforeEach(() => {
  db = openMemoryDb();
  requests = [];
  gateQuestions = [];
  gateSays = [];

  const repo = mkdtempSync(join(tmpdir(), "rooms-channel-"));
  syncProjects(
    db,
    ["Hobbyist", "Conduit", "Arlo"].map((name) => ({
      id: name.toLowerCase(),
      name,
      path: repo,
      color: "#c4906c",
      activity: { projectId: name.toLowerCase(), status: "idle" as const, sessions: [] },
      sessions: [],
    })),
  );
  members = listProjects(db);

  const ledger = createSqliteLedger(db);
  for (const member of members) {
    ledger.writeBrief(member.id, `# ${member.displayName}`, "lead");
    ledger.writePersona(member.id, `Ask me about: the ${member.handle} things.`, "lead");
  }

  const bus = createConversationBus();
  const briefs = createBriefs({ db, ledger, runtime: echoRuntime });
  const turns = createLeadTurns({ db, ledger, runtime: echoRuntime, briefs, appTools: { for: () => [] }, bus });
  const personas = { ensure: async () => ledger.readPersona("x")!, prepare: () => undefined, isWriting: () => false };
  service = createChannelService({ db, ledger, bus, turns, gate: fakeGate, personas });
});

describe("taggedMembers", () => {
  it("returns tagged members in the order tagged", () => {
    const tagged = taggedMembers("@conduit then @hobbyist", listProjects(db));
    expect(tagged.map((project) => project.handle)).toEqual(["conduit", "hobbyist"]);
  });

  it("expands @all to everyone, without repeating someone already tagged", () => {
    const tagged = taggedMembers("@arlo first, then @all", listProjects(db));
    expect(tagged.map((project) => project.handle)).toEqual(["arlo", "hobbyist", "conduit"]);
  });

  it("treats a handle that is not a member as plain text", () => {
    expect(taggedMembers("@lavvo are you there", listProjects(db))).toEqual([]);
  });
});

describe("namedMembers", () => {
  const project = (handle: string, displayName = handle): Project => ({
    id: handle,
    kind: "project",
    handle,
    displayName,
    repoPath: `/${handle}`,
    productId: null,
    color: "#c4906c",
  });
  const room = [project("conduit"), project("conduit-rooms"), project("fc", "Founders Circle")];
  const handles = (body: string) => namedMembers(body, room).map((member) => member.handle);

  it("finds a project named in plain words, whatever the capitals", () => {
    expect(handles("Conduit, are you working on anything right now?")).toEqual(["conduit"]);
  });

  it("does not find a name inside a longer name", () => {
    expect(handles("conduit-rooms, what is next?")).toEqual(["conduit-rooms"]);
  });

  it("matches a display name as well as a handle, in the order they appear", () => {
    expect(handles("founders circle first, then conduit")).toEqual(["fc", "conduit"]);
  });

  it("finds nobody in a message that names nobody, or only tags", () => {
    expect(handles("thanks, that helps")).toEqual([]);
    expect(handles("@conduit over to you")).toEqual([]);
    expect(handles("the conduits are blocked")).toEqual([]);
  });
});

describe("leadSpokenTo", () => {
  const conduit: Project = { id: "conduit", kind: "project", handle: "conduit", displayName: "Conduit", repoPath: "/c", productId: null, color: "#c4906c" };
  const reply = (authorKind: "lead" | "user", authorProjectId: string | null = null) =>
    ({ authorKind, authorProjectId }) as never;

  it("is the lead who just spoke, when you say you", () => {
    expect(leadSpokenTo("Is anything pending on you?", reply("lead", "conduit"), [conduit])).toBe(conduit);
    expect(leadSpokenTo("what's ur eta", reply("lead", "conduit"), [conduit])).toBe(conduit);
    expect(leadSpokenTo("and your next release?", reply("lead", "conduit"), [conduit])).toBe(conduit);
  });

  it("is nobody when no lead just spoke, or you did not say you", () => {
    expect(leadSpokenTo("Is anything pending on you?", reply("user"), [conduit])).toBeNull();
    expect(leadSpokenTo("Is anything pending on you?", null, [conduit])).toBeNull();
    expect(leadSpokenTo("is anything pending?", reply("lead", "conduit"), [conduit])).toBeNull();
    expect(leadSpokenTo("the youth team shipped", reply("lead", "conduit"), [conduit])).toBeNull();
  });
});

describe("common room", () => {
  it("sends a follow-up that says you to the lead who just spoke, without asking the gate", async () => {
    service.send(room, members, "Conduit, what was your last release?");
    await idle();
    requests = [];

    service.send(room, members, "Is anything pending on you?");
    await idle();

    expect(gateQuestions).toHaveLength(0);
    expect(requests.map((request) => request.project.handle)).toEqual(["conduit"]);
  });

  it("wakes a lead named in plain words, without asking the gate", async () => {
    service.send(room, members, "Conduit, are you working on anything right now?");
    await idle();

    expect(gateQuestions).toHaveLength(0);
    expect(requests.map((request) => request.project.handle)).toEqual(["conduit"]);
    expect(requests[0]!.reason).toBe("gate_speak");
  });

  it("wakes only the lead that was tagged", async () => {
    service.send(room, members, "@hobbyist can plugins ship UI panels?");
    await idle();

    expect(requests.map((request) => request.project.handle)).toEqual(["hobbyist"]);
    expect(requests[0]!.reason).toBe("addressed");
    expect(service.messages(room).map((message) => message.body)).toEqual([
      "@hobbyist can plugins ship UI panels?",
      "hobbyist here.",
    ]);
  });

  it("does not ask the gate when you tagged someone", async () => {
    gateSays = ["conduit", "arlo"];
    service.send(room, members, "@hobbyist over to you");
    await idle();

    expect(gateQuestions).toHaveLength(0);
    expect(requests.map((request) => request.project.handle)).toEqual(["hobbyist"]);
  });

  it("asks the gate once, about every member together, and wakes the ones it picks", async () => {
    gateSays = ["conduit"];
    service.send(room, members, "how does the tmux session naming work?");
    await idle();

    expect(gateQuestions).toHaveLength(1);
    expect(gateQuestions[0]!.members.map((member) => member.project.handle)).toEqual(["hobbyist", "conduit", "arlo"]);
    expect(requests.map((request) => request.project.handle)).toEqual(["conduit"]);
    expect(requests[0]!.reason).toBe("gate_speak");
    expect(requests[0]!.systemPrompt).toContain("did not tag anyone");
  });

  it("gives the gate the project's persona, and the room before your message but not the message twice", async () => {
    service.send(room, members, "@arlo ping");
    await idle();
    gateQuestions = [];

    service.send(room, members, "and then?");
    await idle();

    const question = gateQuestions[0]!;
    const arlo = question.members.find((member) => member.project.handle === "arlo")!;
    expect(arlo.persona).toBe("Ask me about: the arlo things.");
    expect(question.message).toBe("and then?");
    expect(question.recent.map((message) => message.body)).toEqual(["@arlo ping", "arlo here."]);
  });

  it("stays quiet, with no hint, when the gate picks nobody", async () => {
    service.send(room, members, "thanks all, that was useful");
    await idle();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(requests).toHaveLength(0);
    expect(service.messages(room).map((message) => message.authorKind)).toEqual(["user"]);
  });

  it("says so when the gate cannot be reached, instead of going silent", async () => {
    gateSays = "down";
    service.send(room, members, "is the hook port configurable?");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(requests).toHaveLength(0);
    expect(service.messages(room).at(-1)).toMatchObject({
      authorKind: "system",
      body: "Could not work out who that was for. Use @ to address a project.",
    });
  });

  it("gives each tagged lead a turn in order, and each one sees the reply before it", async () => {
    service.send(room, members, "@conduit @hobbyist agree on the panel API");
    await idle();

    expect(requests.map((request) => request.project.handle)).toEqual(["conduit", "hobbyist"]);
    expect(requests[0]!.prompt).not.toContain("conduit here.");
    expect(requests[1]!.prompt).toContain("conduit: conduit here.");
  });

  it("answers two quick tags of the same lead once", async () => {
    service.send(room, members, "@all sup");
    service.send(room, members, "@arlo what are you doing?");
    await idle();

    // arlo is queued twice. Its first reply has already read both messages.
    expect(requests.filter((request) => request.project.handle === "arlo")).toHaveLength(1);
    expect(requests.at(-1)!.prompt).toContain("You: @arlo what are you doing?");
  });

  it("records who a message tagged", () => {
    const message = service.send(room, members, "@all status?");
    expect(message.mentions).toEqual(["hobbyist", "conduit", "arlo"]);
  });

  describe("answering again", () => {
    const leadReplies = () => service.messages(room).filter((message) => message.authorKind === "lead");

    it("puts a message of yours to whoever it is for once more, though they already answered", async () => {
      const message = service.send(room, members, "@conduit what do you expose?");
      await idle();

      service.rerun(room, members, message.id);
      await idle();

      expect(requests.map((request) => request.project.handle)).toEqual(["conduit", "conduit"]);
      expect(leadReplies()).toHaveLength(2);
    });

    it("drops a lead's reply and has that lead write it afresh", async () => {
      service.send(room, members, "@conduit @hobbyist status?");
      await idle();
      const [first] = leadReplies();

      service.rerun(room, members, first!.id);
      await idle();

      expect(requests.map((request) => request.project.handle)).toEqual(["conduit", "hobbyist", "conduit"]);
      expect(leadReplies().map((reply) => reply.id)).not.toContain(first!.id);
      expect(leadReplies()).toHaveLength(2);
    });

    it("does nothing for a message from another room", async () => {
      service.rerun(room, members, "msg_from_elsewhere");
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(requests).toHaveLength(0);
    });
  });

  describe("in a room with a host", () => {
    const host = () => members.find((member) => member.handle === "arlo")!;

    it("has the host answer whatever is not tagged, without asking the gate", async () => {
      gateSays = ["conduit"];
      service.send(room, members, "conduit, how do the pieces fit together?", host());
      await idle();

      expect(requests.map((request) => request.project.handle)).toEqual(["arlo"]);
      expect(gateQuestions).toHaveLength(0);
    });

    it("has a tagged member answer instead of the host", async () => {
      service.send(room, members, "@hobbyist is the plugin API stable?", host());
      await idle();

      expect(requests.map((request) => request.project.handle)).toEqual(["hobbyist"]);
    });
  });
});
