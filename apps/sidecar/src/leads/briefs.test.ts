import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSqliteLedger } from "../ledger/sqliteLedger";
import { openMemoryDb } from "../store/db";
import { createProduct, setProductRepos } from "../store/products";
import { getProject, syncProjects } from "../store/projects";
import { createBriefs } from "./briefs";
import type { LeadRuntime, WakeRequest } from "./runtime";

function setup() {
  const db = openMemoryDb();
  const ledger = createSqliteLedger(db);
  const requests: WakeRequest[] = [];

  /** Every brief comes back as a title naming who wrote it. */
  const runtime: LeadRuntime = {
    wake(request) {
      requests.push(request);
      return {
        id: `wake_${requests.length}`,
        stop: () => undefined,
        events: (async function* () {
          yield { type: "text" as const, text: `# ${request.project.displayName}\n\n## Purpose\nWritten by ${request.project.handle}.` };
          yield { type: "finished" as const };
        })(),
      };
    },
  };

  const repo = (id: string, name: string) => ({
    id,
    name,
    path: mkdtempSync(join(tmpdir(), `rooms-briefs-${id}-`)),
    color: "#c4906c",
    activity: { projectId: id, status: "idle" as const, sessions: [] },
    sessions: [],
  });
  syncProjects(db, [repo("p1", "arlo"), repo("p2", "arlo-desktop"), repo("p3", "lavvo")]);

  return { db, ledger, requests, briefs: createBriefs({ db, ledger, runtime }) };
}

describe("a product's brief", () => {
  it("is written from its repos' briefs, each of which is written first if missing", async () => {
    const { db, ledger, requests, briefs } = setup();
    ledger.writeBrief("p1", "# arlo\n\n## Purpose\nAlready known.", "lead");
    const product = createProduct(db, "Arlo", "arlo-product", ["p1", "p2"]);

    const brief = await briefs.ensure(product);

    expect(requests.map((request) => request.project.handle)).toEqual(["arlo-desktop", "arlo-product"]);
    expect(requests[1]!.prompt).toContain("Already known.");
    expect(requests[1]!.prompt).toContain("Written by arlo-desktop.");
    expect(brief?.body).toContain("Written by arlo-product.");
  });

  it("lets its lead read every repo under it, and no other", async () => {
    const { db, requests, briefs } = setup();
    const product = createProduct(db, "Arlo", "arlo-product", ["p1", "p2"]);

    await briefs.ensure(product);

    expect(requests.at(-1)!.access).toMatchObject({
      kind: "repo",
      roots: [getProject(db, "p1")!.repoPath, getProject(db, "p2")!.repoPath],
    });
  });

  it("is written once, then again when the product's repos change", async () => {
    const { db, requests, briefs } = setup();
    const product = createProduct(db, "Arlo", "arlo-product", ["p1"]);

    await briefs.ensure(product);
    expect(briefs.isDue(product)).toBe(false);
    await briefs.ensure(product);
    expect(requests).toHaveLength(2);

    await new Promise((resolve) => setTimeout(resolve, 3));
    setProductRepos(db, product.id, ["p1", "p3"]);

    expect(briefs.isDue(product)).toBe(true);
  });

  it("does not start two writes when asked twice at once", async () => {
    const { db, requests, briefs } = setup();
    const product = createProduct(db, "Arlo", "arlo-product", []);

    await Promise.all([briefs.ensure(product), briefs.ensure(product)]);

    expect(requests).toHaveLength(1);
  });
});
