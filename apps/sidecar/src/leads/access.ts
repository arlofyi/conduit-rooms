import type { Project } from "@rooms/shared";
import type { Db } from "../store/db";
import { listProductRepos } from "../store/products";
import { NO_ACCESS, type WakeAccess } from "./runtime";

/**
 * What a speaker may reach while it works, and how many lookups it gets:
 *
 *   project  its own repo
 *   product  every repo under it
 *   hired    the web
 *
 * Read fresh for each wake, so a repo put under a product a moment ago is
 * already readable by that product's lead.
 */
export function accessFor(db: Db, project: Project, lookups: number): WakeAccess {
  if (project.kind === "hired") return { kind: "web", maxCalls: lookups };

  const repos = project.kind === "product" ? listProductRepos(db, project.id) : [project];
  const [first, ...rest] = repos.flatMap((repo) => (repo.repoPath ? [repo.repoPath] : []));

  // A product with no repos left has nothing to read. It can still answer from its brief.
  return first ? { kind: "repo", roots: [first, ...rest], maxReads: lookups } : NO_ACCESS;
}
