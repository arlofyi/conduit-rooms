import type { Project } from "@rooms/shared";
import type { Ledger } from "../ledger/ledger";
import type { Db } from "../store/db";
import { getHiredAgent } from "../store/hiredAgents";
import { listProductRepos } from "../store/products";
import { listProjects } from "../store/projects";
import type { Knowledge } from "./prompts";

/**
 * What a speaker knows as a wake begins, read fresh from the ledger each time
 * (principle P3: if it is not in the ledger, they do not know it).
 */
export function knowledgeOf(db: Db, ledger: Ledger, project: Project): Knowledge {
  switch (project.kind) {
    case "project":
      return { kind: "project", brief: ledger.readBrief(project.id) };

    case "product":
      return { kind: "product", brief: ledger.readBrief(project.id), repos: reposDigest(db, ledger, project) };

    case "hired":
      return {
        kind: "hired",
        instructions: getHiredAgent(db, project.id)?.instructions ?? "",
        projects: projectsDigest(db, ledger),
      };
  }
}

/** A hired agent is handed every project. Each one's share is cut to this, so thirty of them still fit. */
const PER_PROJECT_CHARS = 1_400;

/** A product's lead is handed only its own repos, so each can say more, and what it owns matters. */
const PER_REPO_CHARS = 3_000;

const NOTHING_KNOWN = "No brief yet. Nothing is known about this project.";

/**
 * Every project and product, as its own lead describes it: the Purpose and
 * State of its brief. One nobody has talked to yet has no brief, and is
 * listed as such, so the agent knows it exists and that it knows nothing of it.
 */
export function projectsDigest(db: Db, ledger: Ledger): string {
  const everyone = listProjects(db).filter((project) => project.kind !== "hired");
  const productOf = new Map(everyone.map((project) => [project.id, project]));

  return everyone
    .map((project) => {
      const brief = ledger.readBrief(project.id);
      const summary = brief ? sectionsOf(brief.body, ["Purpose", "State"], PER_PROJECT_CHARS) : NOTHING_KNOWN;
      return `### ${project.displayName} (@${project.handle})${placeOf(project, productOf)}\n${summary}`;
    })
    .join("\n\n");
}

/** Says how a project and a product relate, so the agent can tell a product from the repos under it. */
function placeOf(project: Project, byId: ReadonlyMap<string, Project>): string {
  if (project.kind === "product") return ", a product made of several of the projects here";

  const product = project.productId ? byId.get(project.productId) : undefined;
  return product ? `, part of ${product.displayName}` : "";
}

/** The repos under a product: where each one is, and what its own lead says it is, does and owns. */
function reposDigest(db: Db, ledger: Ledger, product: Project): string {
  return listProductRepos(db, product.id)
    .map((repo) => {
      const brief = ledger.readBrief(repo.id);
      const summary = brief
        ? sectionsOf(brief.body, ["Purpose", "State", "Owned surface"], PER_REPO_CHARS)
        : NOTHING_KNOWN;
      return `### ${repo.displayName} (@${repo.handle})\nPath: ${repo.repoPath}\n${summary}`;
    })
    .join("\n\n");
}

/** The text under these headings of a brief, cut to a length. The whole brief if it has none of them. */
function sectionsOf(briefBody: string, titles: readonly string[], maxChars: number): string {
  const parts = titles
    .map((title) => {
      const match = new RegExp(`^## ${title}\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, "m").exec(briefBody);
      return match?.[1]?.trim();
    })
    .filter(Boolean)
    .join("\n");

  const text = parts || briefBody;
  return text.length > maxChars ? `${text.slice(0, maxChars)}...` : text;
}
