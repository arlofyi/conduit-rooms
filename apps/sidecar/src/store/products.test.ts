import { beforeEach, describe, expect, it } from "vitest";
import { openMemoryDb, type Db } from "./db";
import { ensureDirectChats, listDirectChats } from "./directChats";
import { createProduct, listProductRepos, removeProduct, reposChangedAt, setProductRepos } from "./products";
import { getProject, isHandleTaken, listProjects, syncProjects } from "./projects";
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

const CONDUIT = [conduitProject("p1", "arlo"), conduitProject("p2", "arlo-desktop"), conduitProject("p3", "lavvo")];

const handlesUnder = (productId: string) => listProductRepos(db, productId).map((repo) => repo.handle);

beforeEach(() => {
  db = openMemoryDb();
  syncProjects(db, CONDUIT);
});

describe("making a product", () => {
  it("puts the chosen repos under it, and leaves the rest alone", () => {
    const product = createProduct(db, "Arlo", "arlo-product", ["p1", "p2"]);

    expect(product).toMatchObject({ kind: "product", handle: "arlo-product", repoPath: null, productId: null });
    expect(handlesUnder(product.id)).toEqual(["arlo", "arlo-desktop"]);
    expect(getProject(db, "p1")?.productId).toBe(product.id);
    expect(getProject(db, "p3")?.productId).toBeNull();
  });

  it("gives it a room that is listed from the start", () => {
    const product = createProduct(db, "Arlo", "arlo-product", ["p1"]);
    ensureDirectChats(db);

    const room = listDirectChats(db).find((chat) => chat.projectId === product.id);
    expect(room?.addedAt).not.toBeNull();
  });

  it("only takes projects: not another product", () => {
    const first = createProduct(db, "Arlo", "arlo-product", ["p1"]);
    const second = createProduct(db, "Everything", "everything", [first.id, "p3"]);

    expect(handlesUnder(second.id)).toEqual(["lavvo"]);
  });

  it("keeps its repos through a sync with Conduit", () => {
    const product = createProduct(db, "Arlo", "arlo-product", ["p1", "p2"]);
    syncProjects(db, CONDUIT);

    expect(getProject(db, product.id)).toMatchObject({ kind: "product" });
    expect(listProjects(db).some((project) => project.id === product.id)).toBe(true);
    expect(handlesUnder(product.id)).toEqual(["arlo", "arlo-desktop"]);
  });
});

describe("changing a product's repos", () => {
  it("moves a repo out of the product it was under", () => {
    const arlo = createProduct(db, "Arlo", "arlo-product", ["p1", "p2"]);
    const desktop = createProduct(db, "Desktop apps", "desktop-apps", ["p2", "p3"]);

    expect(handlesUnder(arlo.id)).toEqual(["arlo"]);
    expect(handlesUnder(desktop.id)).toEqual(["arlo-desktop", "lavvo"]);
  });

  it("replaces the whole list", () => {
    const product = createProduct(db, "Arlo", "arlo-product", ["p1", "p2"]);
    setProductRepos(db, product.id, ["p3"]);

    expect(handlesUnder(product.id)).toEqual(["lavvo"]);
    expect(getProject(db, "p1")?.productId).toBeNull();
  });

  it("records that the product changed, so its brief is known to be out of date", async () => {
    const product = createProduct(db, "Arlo", "arlo-product", ["p1"]);
    const before = reposChangedAt(db, product.id)!;

    await new Promise((resolve) => setTimeout(resolve, 3));
    setProductRepos(db, product.id, ["p1", "p2"]);

    expect(reposChangedAt(db, product.id)! > before).toBe(true);
  });
});

describe("taking a product apart", () => {
  it("frees its repos and its handle, and takes it out of every room", () => {
    const product = createProduct(db, "Arlo", "arlo-product", ["p1", "p2"]);
    const room = createRoom(db, "planning", [product.id, "p3"]);

    removeProduct(db, product.id);

    expect(listProjects(db).some((project) => project.id === product.id)).toBe(false);
    expect(getProject(db, "p1")?.productId).toBeNull();
    expect(isHandleTaken(db, "arlo-product")).toBe(false);
    expect(listRoomMembers(db, room.id).map((member) => member.handle)).toEqual(["lavvo"]);
  });
});
