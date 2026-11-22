import { describe, expect, it } from "vitest";
import { createSqliteLedger } from "../ledger/sqliteLedger";
import { openMemoryDb } from "../store/db";
import { hireAgent } from "../store/hiredAgents";
import { createProduct } from "../store/products";
import { getProject, syncProjects } from "../store/projects";
import { knowledgeOf } from "./knowledge";

const conduitProject = (id: string, name: string) => ({
  id,
  name,
  path: `/${id}`,
  color: "#c4906c",
  activity: { projectId: id, status: "idle" as const, sessions: [] },
  sessions: [],
});

function setup() {
  const db = openMemoryDb();
  const ledger = createSqliteLedger(db);
  syncProjects(db, [conduitProject("p1", "Arlo"), conduitProject("p2", "Lavvo")]);
  ledger.writeBrief("p1", "# Arlo\n\n## Purpose\nA workspace app.\n\n## State\nShipping.\n\n## Interests\nNone yet.", "lead");
  return { db, ledger };
}

describe("knowledgeOf", () => {
  it("gives a project's lead its own brief and nothing about other projects", () => {
    const { db, ledger } = setup();
    const knowledge = knowledgeOf(db, ledger, getProject(db, "p1")!);

    expect(knowledge).toMatchObject({ kind: "project", brief: { body: expect.stringContaining("A workspace app.") } });
  });

  it("gives a hired agent its instructions and every project's summary", () => {
    const { db, ledger } = setup();
    const { agent } = hireAgent(db, "Strategist", "Think ahead.");
    const knowledge = knowledgeOf(db, ledger, agent);

    if (knowledge.kind !== "hired") throw new Error("expected hired knowledge");
    expect(knowledge.instructions).toBe("Think ahead.");
    expect(knowledge.projects).toContain("### Arlo (@arlo)\nA workspace app.\nShipping.");
    expect(knowledge.projects).not.toContain("Interests");
  });

  it("tells a hired agent which projects it knows nothing about, and never lists agents as projects", () => {
    const { db, ledger } = setup();
    hireAgent(db, "CTO", "Advise.");
    const { agent } = hireAgent(db, "Strategist", "Think ahead.");
    const knowledge = knowledgeOf(db, ledger, agent);

    if (knowledge.kind !== "hired") throw new Error("expected hired knowledge");
    expect(knowledge.projects).toContain("### Lavvo (@lavvo)\nNo brief yet.");
    expect(knowledge.projects).not.toContain("CTO");
  });

  it("gives a product's lead its own brief and what each of its repos says, with where the repo is", () => {
    const { db, ledger } = setup();
    const product = createProduct(db, "Arlo Suite", "arlo-suite", ["p1", "p2"]);
    ledger.writeBrief(product.id, "# Arlo Suite\n\n## Purpose\nThe whole thing.", "lead");

    const knowledge = knowledgeOf(db, ledger, product);

    if (knowledge.kind !== "product") throw new Error("expected product knowledge");
    expect(knowledge.brief?.body).toContain("The whole thing.");
    expect(knowledge.repos).toContain("### Arlo (@arlo)\nPath: /p1\nA workspace app.\nShipping.");
    expect(knowledge.repos).toContain("### Lavvo (@lavvo)\nPath: /p2\nNo brief yet.");
  });

  it("tells a hired agent which projects are part of which product", () => {
    const { db, ledger } = setup();
    createProduct(db, "Arlo Suite", "arlo-suite", ["p1"]);
    const { agent } = hireAgent(db, "Strategist", "Think ahead.");
    const knowledge = knowledgeOf(db, ledger, agent);

    if (knowledge.kind !== "hired") throw new Error("expected hired knowledge");
    expect(knowledge.projects).toContain("### Arlo (@arlo), part of Arlo Suite\n");
    expect(knowledge.projects).toContain("### Arlo Suite (@arlo-suite), a product made of several of the projects here\n");
    expect(knowledge.projects).toContain("### Lavvo (@lavvo)\n");
  });
});
