import type { ParticipantKind } from "@rooms/shared";
import { describe, expect, it } from "vitest";
import { groupByProduct } from "./groupByProduct";
import type { Contact } from "./useWorkspace";

function contact(handle: string, kind: ParticipantKind = "project", productId: string | null = null): Contact {
  return {
    project: { id: handle, kind, handle, displayName: handle, repoPath: kind === "project" ? `/${handle}` : null, productId, color: "#c4906c" },
    chat: { id: `dm_${handle}`, projectId: handle, addedAt: null, lastActivityAt: null, leadStatus: "listening" },
  };
}

const handles = (contacts: Contact[]) => contacts.map((entry) => entry.project.handle);

describe("groupByProduct", () => {
  it("puts each repo under its product and keeps the rest loose", () => {
    const grouped = groupByProduct([
      contact("arlo", "project", "suite"),
      contact("conduit"),
      contact("arlo-desktop", "project", "suite"),
      contact("suite", "product"),
      contact("cto", "hired"),
    ]);

    expect(grouped.products).toHaveLength(1);
    expect(handles(grouped.products[0]!.repos)).toEqual(["arlo", "arlo-desktop"]);
    expect(handles(grouped.loose)).toEqual(["conduit"]);
    expect(handles(grouped.hired)).toEqual(["cto"]);
  });

  it("keeps a product that has no repos yet", () => {
    const grouped = groupByProduct([contact("suite", "product")]);
    expect(grouped.products[0]!.repos).toEqual([]);
  });

  it("treats a repo as loose when its product is not in the list", () => {
    const grouped = groupByProduct([contact("arlo", "project", "gone")]);
    expect(handles(grouped.loose)).toEqual(["arlo"]);
  });
});
