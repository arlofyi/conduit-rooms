import { beforeEach, describe, expect, it } from "vitest";
import { openMemoryDb, type Db } from "./db";
import { ensureDirectChats, listDirectChats } from "./directChats";
import { dismissAgent, getHiredAgent, hireAgent } from "./hiredAgents";
import { listProjects, syncProjects } from "./projects";
import { createRoom, listRoomMembers } from "./rooms";

let db: Db;

const conduitProject = (id: string, name: string) => ({
  id,
  name,
  path: `/${id}`,
  color: "#c4906c",
  activity: { projectId: id, status: "idle" as const, sessions: [] },
  sessions: [],
});

beforeEach(() => {
  db = openMemoryDb();
  syncProjects(db, [conduitProject("p1", "Arlo"), conduitProject("p2", "CTO")]);
});

describe("hiring an agent", () => {
  it("gives it a handle, no repo, and its instructions", () => {
    const { agent, hired } = hireAgent(db, "Head of Research", "Find things out.");

    expect(agent).toMatchObject({ kind: "hired", handle: "head-of-research", displayName: "Head of Research", repoPath: null });
    expect(getHiredAgent(db, agent.id)).toEqual(hired);
    expect(hired.instructions).toBe("Find things out.");
  });

  it("never takes a handle a project already has", () => {
    expect(hireAgent(db, "CTO", "Advise.").agent.handle).toBe("cto-2");
  });

  it("lists it after the projects, and gives it a room that is listed from the start", () => {
    const { agent } = hireAgent(db, "Strategist", "Think ahead.");
    ensureDirectChats(db);

    expect(listProjects(db).map((project) => project.handle)).toEqual(["arlo", "cto", "strategist"]);
    const room = listDirectChats(db).find((chat) => chat.projectId === agent.id)!;
    expect(room.addedAt).not.toBeNull();
  });

  it("survives a sync with Conduit, which knows nothing about it", () => {
    hireAgent(db, "Strategist", "Think ahead.");
    syncProjects(db, [conduitProject("p1", "Arlo")]);

    expect(listProjects(db).map((project) => project.handle)).toEqual(["arlo", "strategist"]);
  });
});

describe("letting an agent go", () => {
  it("takes it out of the list and out of every room", () => {
    const { agent } = hireAgent(db, "Strategist", "Think ahead.");
    const room = createRoom(db, "planning", ["p1", agent.id]);

    dismissAgent(db, agent.id);

    expect(listProjects(db).some((project) => project.id === agent.id)).toBe(false);
    expect(listRoomMembers(db, room.id).map((member) => member.handle)).toEqual(["arlo"]);
  });

  it("gives its handle back", () => {
    const first = hireAgent(db, "Strategist", "Think ahead.").agent;
    dismissAgent(db, first.id);

    expect(hireAgent(db, "Strategist", "Think again.").agent.handle).toBe("strategist");
  });

  it("cannot be used to remove a project", () => {
    const room = createRoom(db, "planning", ["p1"]);
    dismissAgent(db, "p1");

    expect(listProjects(db).map((project) => project.handle)).toContain("arlo");
    expect(listRoomMembers(db, room.id)).toHaveLength(1);
  });
});
