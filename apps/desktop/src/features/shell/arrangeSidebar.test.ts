import type { ParticipantKind, ProjectStatus } from "@rooms/shared";
import { describe, expect, it } from "vitest";
import type { Contact } from "@/features/workspace/useWorkspace";
import { arrangeSidebar, type SidebarEntry } from "./arrangeSidebar";

interface Given {
  kind?: ParticipantKind;
  productId?: string;
  talkedAt?: string;
}

function contact(handle: string, { kind = "project", productId, talkedAt }: Given = {}): Contact {
  return {
    project: { id: handle, kind, handle, displayName: handle, repoPath: null, productId: productId ?? null, color: "#c4906c" },
    chat: { id: `dm_${handle}`, projectId: handle, addedAt: null, lastActivityAt: talkedAt ?? null, leadStatus: "listening" },
  };
}

const statuses = (given: Record<string, ProjectStatus>) => (projectId: string) => given[projectId] ?? "idle";
const handles = (contacts: Contact[]) => contacts.map((entry) => entry.project.handle);
const names = (entries: SidebarEntry[]) => entries.map((entry) => entry.contact.project.handle);

describe("arrangeSidebar", () => {
  it("shows a project that is busy or that you talk to, and folds the rest away as quiet", () => {
    const arranged = arrangeSidebar(
      [contact("orbit"), contact("lavvo", { talkedAt: "2026-11-20T10:00:00.000Z" }), contact("hobbyist")],
      statuses({ hobbyist: "working" }),
    );

    expect(names(arranged.entries)).toEqual(["hobbyist", "lavvo"]);
    expect(handles(arranged.quiet)).toEqual(["orbit"]);
  });

  it("puts what needs you first, then what is working, then the most recent chat", () => {
    const arranged = arrangeSidebar(
      [
        contact("older", { talkedAt: "2026-11-19T10:00:00.000Z" }),
        contact("newer", { talkedAt: "2026-11-21T10:00:00.000Z" }),
        contact("busy"),
        contact("stuck"),
      ],
      statuses({ busy: "working", stuck: "needs_you" }),
    );

    expect(names(arranged.entries)).toEqual(["stuck", "busy", "newer", "older"]);
  });

  it("gives a product the most pressing status of its repos, and always lists it", () => {
    const arranged = arrangeSidebar(
      [
        contact("suite", { kind: "product" }),
        contact("api", { productId: "suite" }),
        contact("web", { productId: "suite" }),
        contact("docs", { productId: "suite" }),
        contact("empty", { kind: "product" }),
      ],
      statuses({ api: "working", web: "needs_you" }),
    );

    const [suite, empty] = arranged.entries;
    if (suite?.kind !== "product" || empty?.kind !== "product") throw new Error("expected two products");

    expect(suite.status).toBe("needs_you");
    expect(handles(suite.repos)).toEqual(["web", "api"]);
    expect(handles(suite.quietRepos)).toEqual(["docs"]);
    expect(empty).toMatchObject({ status: "idle", repos: [], quietRepos: [] });
  });

  it("keeps hired agents apart from projects", () => {
    const arranged = arrangeSidebar([contact("cto", { kind: "hired" }), contact("orbit")], statuses({}));

    expect(handles(arranged.agents)).toEqual(["cto"]);
    expect(arranged.entries).toEqual([]);
  });
});
