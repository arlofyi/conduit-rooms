import { beforeEach, describe, expect, it } from "vitest";
import { openMemoryDb } from "../store/db";
import { syncProjects } from "../store/projects";
import type { Ledger } from "./ledger";
import { createSqliteLedger } from "./sqliteLedger";

let ledger: Ledger;

beforeEach(() => {
  const db = openMemoryDb();
  syncProjects(db, [
    {
      id: "p1",
      name: "Arlo",
      path: "/arlo",
      color: "#c4906c",
      activity: { projectId: "p1", status: "idle", sessions: [] },
      sessions: [],
    },
  ]);
  ledger = createSqliteLedger(db);
});

describe("personas", () => {
  it("has none until one is written", () => {
    expect(ledger.readPersona("p1")).toBeNull();
  });

  it("keeps every version and reads back the newest, with who wrote it", () => {
    ledger.writePersona("p1", "Arlo is a workspace app.", "lead");
    const edited = ledger.writePersona("p1", "Arlo is a workspace app.\nAsk me about: pages.", "user");

    expect(edited).toMatchObject({ version: 2, writtenBy: "user" });
    expect(ledger.readPersona("p1")).toMatchObject({
      version: 2,
      body: "Arlo is a workspace app.\nAsk me about: pages.",
      writtenBy: "user",
    });
  });

  it("is stored apart from the brief", () => {
    ledger.writeBrief("p1", "# Arlo", "lead");
    ledger.writePersona("p1", "Arlo is a workspace app.", "lead");

    expect(ledger.readBrief("p1")?.body).toBe("# Arlo");
    expect(ledger.readPersona("p1")?.body).toBe("Arlo is a workspace app.");
  });
});
