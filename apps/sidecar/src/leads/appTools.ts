import {
  ARTIFACT_MAX_LENGTH,
  ARTIFACT_TITLE_MAX_LENGTH,
  REPLY_LOOKUPS,
  SESSION_STATUS_LABEL,
  slugifyHandle,
  type Project,
} from "@rooms/shared";
import { z } from "zod";
import type { ConversationBus } from "../chat/conversationBus";
import { readConduitProjects } from "../conduit/readProjects";
import {
  SESSION_BRIEF_MAX_LENGTH,
  SESSION_NAME_MAX_LENGTH,
  SessionNotStartedError,
  type StartSession,
} from "../conduit/startSession";
import type { Ledger } from "../ledger/ledger";
import type { Db } from "../store/db";
import { insertArtifact } from "../store/artifacts";
import { logEvent } from "../store/events";
import { listProjects } from "../store/projects";
import { accessFor } from "./access";
import type { Briefs } from "./briefs";
import { knowledgeOf } from "./knowledge";
import { askedPrompt, askedSystemPrompt } from "./prompts";
import { collectText, WakeFailedError, type AppTool, type LeadRuntime } from "./runtime";

/**
 * The tools a speaker has for Rooms itself, as opposed to a repo or the web:
 *
 *   ask_lead       put a question to a project's or a product's lead and get its answer
 *   write_briefs   have leads that have no brief yet write theirs, in the background
 *   read_brief     read a lead's whole brief
 *   list_sessions  see what Conduit is running in a project
 *   write_artifact make a page for the person to open beside the chat
 *   start_session  start an agent in Conduit on a project, with a brief. This is how work gets done.
 *
 * Who gets which:
 *
 *   hired agent    the first four and start_session for any project, and write_artifact
 *   product lead   the first four for any project, start_session for the repos under it, and write_artifact
 *   project lead   list_sessions and start_session for its own project only, and write_artifact
 *
 * A lead that was woken by ask_lead gets none of them, so one question can
 * never set off a chain of leads asking each other.
 */
export interface AppTools {
  /**
   * The tools for one speaker. `reply` says which reply is being written, and
   * is needed for anything that attaches to it. Without it, as when a tool is
   * used outside a reply, such tools are not offered.
   */
  for(speaker: Project, reply?: ReplyBeingWritten): AppTool[];
}

/**
 * The reply a turn is writing. The message is stored a moment after the wake
 * begins, so `messageId` is filled in then, before any tool can run.
 */
export interface ReplyBeingWritten {
  conversationId: string;
  messageId: string | null;
}

interface Deps {
  db: Db;
  ledger: Ledger;
  runtime: LeadRuntime;
  briefs: Briefs;
  bus: ConversationBus;
  conduitDataDir: string;
  startSession: StartSession;
}

/** The most projects one write_briefs call may start. Each brief is a long model run. */
export const BRIEFS_PER_CALL = 10;

/** How many briefs are written at once, across every call. */
const BRIEFS_AT_ONCE = 3;

/** How many sessions one reply may start. A session is real work on real code, so a reply cannot fan out. */
export const SESSIONS_PER_REPLY = 3;

/** A lead answering another speaker has someone waiting on it, and a smaller budget than for you. */
const ASKED_LOOKUPS = Math.floor(REPLY_LOOKUPS / 2);
const ASKED_LIMITS = { effort: "quick", firstTextTimeoutMs: 60_000 } as const;

const handle = z.string().describe("A handle as listed to you, without the @: arlo-desktop");

/** Thrown for a mistake the speaker can fix. Its message is handed back as the tool's answer. */
class Refused extends Error {}

export function createAppTools({ db, ledger, runtime, briefs, bus, conduitDataDir, startSession }: Deps): AppTools {
  /** Briefs waiting to be written, and how many are being written now. */
  const queue: Project[] = [];
  let writing = 0;

  function writeNextBrief(): void {
    while (writing < BRIEFS_AT_ONCE) {
      const project = queue.shift();
      if (!project) return;

      writing += 1;
      briefs
        .ensure(project)
        .then((brief) => logEvent(db, "brief_refreshed", null, { projectId: project.id, version: brief?.version }))
        .catch((error) => console.error(`[sidecar] could not write a brief for ${project.handle}:`, error))
        .finally(() => {
          writing -= 1;
          writeNextBrief();
        });
    }
  }

  /** A project or a product, by handle. Agents you hired have no brief, no sessions and are not asked. */
  function requireLead(asked: string): Project {
    const wanted = asked.replace(/^@/, "").toLowerCase();
    const lead = listProjects(db).find((project) => project.handle === wanted && project.kind !== "hired");
    if (!lead) throw new Refused(`There is no project or product called @${wanted}.`);
    return lead;
  }

  async function sessionsOf(project: Project): Promise<string> {
    const repos = project.kind === "product" ? listProjects(db).filter((repo) => repo.productId === project.id) : [project];
    const running = await readConduitProjects(conduitDataDir);

    const lines = repos.flatMap((repo) => {
      const sessions = running.find((entry) => entry.id === repo.id)?.activity.sessions ?? [];
      return sessions.map(
        (session) =>
          `- ${repo.handle}: "${session.name}" (${session.agent}, ${SESSION_STATUS_LABEL[session.status]}` +
          `${session.branch ? `, branch ${session.branch}` : ""})`,
      );
    });

    return lines.length > 0 ? lines.join("\n") : `Conduit is running no sessions in @${project.handle}.`;
  }

  async function ask(asker: Project, target: Project, question: string): Promise<string> {
    if (target.id === asker.id) throw new Refused("That is you. Answer from what you know.");

    await briefs.ensure(target);
    const wake = runtime.wake({
      project: target,
      reason: "addressed_by_lead",
      systemPrompt: askedSystemPrompt(target, knowledgeOf(db, ledger, target), asker),
      prompt: askedPrompt(asker, question),
      access: accessFor(db, target, ASKED_LOOKUPS),
      limits: ASKED_LIMITS,
      // No app tools: a lead that was asked answers, and does not ask onward.
    });

    logEvent(db, "wake_started", null, { wakeId: wake.id, reason: "addressed_by_lead", projectId: target.id, askedBy: asker.id });
    return collectText(wake);
  }

  function queueBriefs(handles: readonly string[]): string {
    if (handles.length > BRIEFS_PER_CALL) {
      throw new Refused(`That is ${handles.length} projects. Ask for ${BRIEFS_PER_CALL} at most in one call.`);
    }

    const leads = handles.map(requireLead);
    const due = leads.filter((lead) => briefs.isDue(lead) && !queue.includes(lead));
    const has = leads.filter((lead) => !briefs.isDue(lead));

    queue.push(...due);
    writeNextBrief();

    return [
      due.length > 0 &&
        `Started: ${list(due)}. Each takes about a minute and they are written ${BRIEFS_AT_ONCE} at a time. ` +
          "They are not ready yet. Read them with read_brief in a later reply.",
      has.length > 0 && `Already have a brief: ${list(has)}.`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const listSessions = (project: Project): AppTool => ({
    name: "list_sessions",
    description: `See what Conduit is running in ${project.displayName} right now: each session, its agent and whether it is working, waiting on the person, done or idle.`,
    input: {},
    step: () => ({ kind: "sessions", subject: project.handle }),
    run: () => sessionsOf(project),
  });

  const everything = (asker: Project): AppTool[] => [
    {
      name: "ask_lead",
      description:
        "Put one question to the lead of a project or a product and get its answer. Use it when the answer is in that project's code, which its lead can read and you may not be able to. It takes up to a minute, so ask one clear question.",
      input: { handle, question: z.string().min(3).describe("The question, with everything the lead needs to answer it.") },
      step: ({ handle: asked }) => ({ kind: "ask", subject: String(asked) }),
      run: ({ handle: asked, question }) => ask(asker, requireLead(String(asked)), String(question)),
    },
    {
      name: "write_briefs",
      description: `Have the leads of projects that have no brief yet write theirs. It starts the work and returns at once. At most ${BRIEFS_PER_CALL} projects in one call. Each brief costs the person about a minute of model time, so ask for the ones the question needs.`,
      input: { handles: z.array(handle).min(1) },
      step: ({ handles }) => ({ kind: "queue_briefs", subject: countOf(handles) }),
      run: async ({ handles }) => queueBriefs(handles as string[]),
    },
    {
      name: "read_brief",
      description: "Read the whole brief of a project or a product: what its own lead knows about it. Longer than the summary you were given.",
      input: { handle },
      step: ({ handle: asked }) => ({ kind: "read_brief", subject: String(asked) }),
      run: async ({ handle: asked }) => {
        const lead = requireLead(String(asked));
        return ledger.readBrief(lead.id)?.body ?? `@${lead.handle} has no brief yet. write_briefs starts one.`;
      },
    },
    {
      name: "list_sessions",
      description:
        "See what Conduit is running in a project, or in every repo of a product: each session, its agent and whether it is working, waiting on the person, done or idle.",
      input: { handle },
      step: ({ handle: asked }) => ({ kind: "sessions", subject: String(asked) }),
      run: ({ handle: asked }) => sessionsOf(requireLead(String(asked))),
    },
  ];

  const writeArtifact = (speaker: Project, reply: ReplyBeingWritten): AppTool => ({
    name: "write_artifact",
    description:
      "Make a page the person can open beside the chat, for something better seen than read: a comparison, a diagram, a timeline, a plan, a mock-up of a screen. " +
      "Give a whole HTML document with its CSS and any JavaScript inline. It is drawn in a sealed panel about 900px wide that cannot load anything from the network except fonts from Google Fonts and scripts from cdnjs, jsDelivr and unpkg, so embed everything else. " +
      "Make it readable on a dark and on a light background with prefers-color-scheme. " +
      "Do not use it for something a few sentences would say. In your reply, say in a line what the page shows: the person sees a card to open it.",
    input: {
      title: z.string().min(2).max(ARTIFACT_TITLE_MAX_LENGTH).describe("A short name for the page: 'Release plan', 'Sidebar options'."),
      html: z.string().min(20).max(ARTIFACT_MAX_LENGTH).describe("The whole HTML document."),
    },
    step: ({ title }) => ({ kind: "artifact", subject: String(title) }),
    run: async ({ title, html }) => {
      if (!reply.messageId) throw new Refused("There is no reply to attach a page to yet. Try again in a moment.");

      const artifact = insertArtifact(db, {
        conversationId: reply.conversationId,
        messageId: reply.messageId,
        projectId: speaker.id,
        title: String(title).trim(),
        html: String(html),
      });
      bus.publish(reply.conversationId, { type: "artifact.created", artifact });

      return `Saved "${artifact.title}". The person sees a card for it under your reply and can open it. Tell them in a line what it shows.`;
    },
  });

  /** The projects a speaker may start work in: its own, the repos under its product, or for a hired agent any. */
  function mayStartIn(speaker: Project, target: Project): boolean {
    if (target.kind !== "project") return false;
    if (speaker.kind === "hired") return true;
    return speaker.kind === "product" ? target.productId === speaker.id : target.id === speaker.id;
  }

  const startSessionTool = (speaker: Project): AppTool => {
    let started = 0;
    const own = speaker.kind === "project";

    return {
      name: "start_session",
      description:
        `Start a Claude session in Conduit${own ? ` on ${speaker.displayName}` : " on a project"}, with a brief you write. This is how work gets done: the session can change files and run commands, which you cannot. ` +
        "Use it only when the person has asked for the work to be done: 'do it', 'go for it', 'start it', 'spawn it'. When they have only asked a question, answer it and offer to start one. " +
        "The session has seen none of this conversation, so the brief must stand alone: what to change, in which files where you know them, what to leave alone, and how to tell it is done. " +
        `At most ${SESSIONS_PER_REPLY} in one reply.`,
      input: {
        ...(own ? {} : { handle }),
        name: z.string().min(3).max(SESSION_NAME_MAX_LENGTH).describe("A short name for the session, shown in the sidebar: 'Add Google Play links'."),
        brief: z.string().min(20).max(SESSION_BRIEF_MAX_LENGTH).describe("The whole instruction for the session."),
        own_branch: z
          .boolean()
          .optional()
          .describe("True to have it work on a branch of its own in a separate worktree. Use it for anything risky or large."),
      },
      step: ({ handle: asked, name }) => ({
        kind: "start_session",
        subject: own ? speaker.handle : String(asked).replace(/^@/, ""),
        label: String(name).trim(),
      }),
      run: async ({ handle: asked, name, brief, own_branch: ownBranch }) => {
        const target = own ? speaker : requireLead(String(asked));
        if (!mayStartIn(speaker, target) || !target.repoPath) {
          throw new Refused(`You cannot start a session in @${target.handle}. ${whereItCan(speaker)}`);
        }
        if (started >= SESSIONS_PER_REPLY) {
          throw new Refused(`You have started ${SESSIONS_PER_REPLY} sessions in this reply, which is the most one reply may start.`);
        }

        const sessionName = String(name).trim();
        await startSession({
          repoPath: target.repoPath,
          name: sessionName,
          brief: String(brief),
          worktree: ownBranch ? slugifyHandle(sessionName) : undefined,
        });
        started += 1;

        logEvent(db, "wake_started", null, { reason: "handoff", projectId: target.id, startedBy: speaker.id, session: sessionName });
        return `Started "${sessionName}" in @${target.handle}. It is running in Conduit now, and the person can open it from the sidebar. Tell them in a line that it has started and what it will do.`;
      },
    };
  };

  return {
    for(speaker, reply) {
      const own = speaker.kind === "project" ? [listSessions(speaker)] : everything(speaker);
      const attached = reply ? [writeArtifact(speaker, reply)] : [];
      return [...own, startSessionTool(speaker), ...attached].map(answeringRefusals);
    },
  };
}

/** A refusal or a lead that could not answer comes back as the tool's answer, so the speaker can carry on. */
function answeringRefusals(tool: AppTool): AppTool {
  return {
    ...tool,
    run: async (input) => {
      try {
        return await tool.run(input);
      } catch (error) {
        if (error instanceof Refused) return error.message;
        if (error instanceof WakeFailedError) return `That lead could not answer: ${error.failure.message}`;
        if (error instanceof SessionNotStartedError) return `The session was not started. ${error.message}`;
        throw error;
      }
    },
  };
}

function whereItCan(speaker: Project): string {
  return speaker.kind === "product" ? "You can start one in the repos under your product." : "You can start one in your own project.";
}

function list(leads: readonly Project[]): string {
  return leads.map((lead) => `@${lead.handle}`).join(", ");
}

function countOf(handles: unknown): string {
  const n = Array.isArray(handles) ? handles.length : 0;
  return `${n} project${n === 1 ? "" : "s"}`;
}
