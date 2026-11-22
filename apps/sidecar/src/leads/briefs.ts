import { describeStep, type Brief, type JoinProgress, type Project, type RepoProgress } from "@rooms/shared";
import type { Ledger } from "../ledger/ledger";
import type { Db } from "../store/db";
import { listProductRepos, reposChangedAt } from "../store/products";
import { accessFor } from "./access";
import { BRIEF_LIMITS, cleanBrief, writeFirstBrief } from "./firstBrief";
import { productBriefPrompt, productBriefSystemPrompt } from "./prompts";
import { collectText, type LeadRuntime, type OnStep } from "./runtime";

/**
 * Briefs: getting one written when a speaker needs it and has none.
 *
 *   project  its lead reads the repo and writes it (firstBrief.ts)
 *   product  its lead writes it from the briefs of the repos under it, so each
 *            of those is written first if it is missing. It is written again
 *            when you change which repos the product has.
 *   hired    has no brief. What it knows is the instructions you gave it.
 */
export interface Briefs {
  /** True when this speaker has to write its brief before it can answer. */
  isDue(project: Project): boolean;
  /**
   * The brief as it stands, written first if it is due. Null for a hired agent.
   * `report` hears how the writing is getting on. If the brief is already being
   * written for someone else, that first caller's report is the one that hears it.
   */
  ensure(project: Project, report?: ReportJoining): Promise<Brief | null>;
}

export type ReportJoining = (progress: JoinProgress) => void;

interface Deps {
  db: Db;
  ledger: Ledger;
  runtime: LeadRuntime;
}

/** A product brief is mostly put together from briefs already written. The reads are for checking how repos connect. */
const PRODUCT_BRIEF_READS = 12;

export function createBriefs({ db, ledger, runtime }: Deps): Briefs {
  /** One write in flight per speaker, so a persona and a first message never start two. */
  const writing = new Map<string, Promise<Brief>>();

  function isDue(project: Project): boolean {
    if (project.kind === "hired") return false;

    const brief = ledger.readBrief(project.id);
    if (!brief) return true;
    if (project.kind === "project") return false;

    const changedAt = reposChangedAt(db, project.id);
    return changedAt !== null && brief.writtenAt < changedAt;
  }

  /**
   * Writes a product's brief. Its repos are read side by side, so progress is
   * reported as a picture of all of them, replaced each time one moves on.
   */
  async function writeProductBrief(product: Project, report?: ReportJoining): Promise<Brief> {
    const repos = listProductRepos(db, product.id);

    const progress = new Map<string, RepoProgress>(
      repos.map((repo) => [repo.id, { handle: repo.handle, state: isDue(repo) ? "waiting" : "done", doing: null }]),
    );
    const tell = (doing: string | null) => report?.({ doing, repos: [...progress.values()] });
    const move = (repo: Project, to: Pick<RepoProgress, "state" | "doing">) => {
      progress.set(repo.id, { handle: repo.handle, ...to });
      tell(null);
    };

    // A repo whose brief cannot be written is described to the product lead as unknown. It does not stop the others.
    await Promise.all(
      repos.filter(isDue).map(async (repo) => {
        move(repo, { state: "reading", doing: null });
        try {
          await ensure(repo, ({ doing }) => move(repo, { state: "reading", doing }));
          move(repo, { state: "done", doing: null });
        } catch {
          move(repo, { state: "failed", doing: null });
        }
      }),
    );

    const wake = runtime.wake({
      project: product,
      reason: "refresh_brief",
      systemPrompt: productBriefSystemPrompt(product),
      prompt: productBriefPrompt(
        product,
        repos.map((repo) => ({ repo, brief: ledger.readBrief(repo.id) })),
      ),
      access: accessFor(db, product, PRODUCT_BRIEF_READS),
      limits: BRIEF_LIMITS,
    });

    tell(`Writing up ${product.displayName}`);
    const body = await collectText(wake, (step) => tell(describeStep(step, "doing")));
    return ledger.writeBrief(product.id, cleanBrief(body), "lead");
  }

  function writeProjectBrief(project: Project, report?: ReportJoining): Promise<Brief> {
    const onStep: OnStep = (step) => report?.({ doing: describeStep(step, "doing"), repos: [] });
    return writeFirstBrief(project, runtime, ledger, onStep);
  }

  function ensure(project: Project, report?: ReportJoining): Promise<Brief | null> {
    if (!isDue(project)) return Promise.resolve(ledger.readBrief(project.id));

    let inFlight = writing.get(project.id);
    if (!inFlight) {
      const write = project.kind === "product" ? writeProductBrief(project, report) : writeProjectBrief(project, report);
      inFlight = write.finally(() => writing.delete(project.id));
      writing.set(project.id, inFlight);
    }
    return inFlight;
  }

  return { isDue, ensure };
}
