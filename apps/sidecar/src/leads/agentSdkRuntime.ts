import {
  createSdkMcpServer,
  query,
  tool,
  type HookCallback,
  type Options,
  type SDKAssistantMessageError,
  type SDKMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { newId, type LeadFailure } from "@rooms/shared";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  allowingAppTools,
  createRepoGuard,
  createWebGuard,
  READ_TOOLS,
  WEB_TOOLS,
  type ToolGuard,
} from "./repoGuard";
import { stepOf } from "./stepOf";
import {
  APP_TOOL_CALLS,
  type AppTool,
  type LeadRuntime,
  type Wake,
  type WakeAccess,
  type WakeEvent,
  type WakeRequest,
} from "./runtime";

/** The one place the lead model is named. Model names never reach the screen. */
const LEAD_MODEL = "claude-opus-5-5";

const SDK_EFFORT = { quick: "low", thorough: "medium" } as const;

/**
 * Where a wake with no repo runs. It is an empty folder, so even if a file
 * tool were somehow offered there would be nothing in it to read.
 */
const EMPTY_WORKDIR = join(tmpdir(), "conduit-rooms-no-repo");

/** The tools, the folder and the guard that go with each kind of access. One place, so they cannot disagree. */
function sandboxFor(access: WakeAccess) {
  if (access.kind === "repo") {
    return {
      cwd: access.roots[0],
      tools: [...READ_TOOLS],
      // Reads inside the working folder need no approval. Nothing is pre-approved beyond that.
      allowedTools: [] as string[],
      guard: createRepoGuard(access.roots, access.maxReads),
      budget: access.maxReads,
    };
  }

  mkdirSync(EMPTY_WORKDIR, { recursive: true });
  return {
    cwd: EMPTY_WORKDIR,
    tools: [...WEB_TOOLS],
    // Web tools ask before running. Nobody is there to ask, so they are approved here and limited by the guard.
    allowedTools: [...WEB_TOOLS] as string[],
    guard: createWebGuard(access.maxCalls),
    budget: access.maxCalls,
  };
}

/** The name app tools are grouped under. The model sees each one as mcp__rooms__<name>. */
const APP_SERVER = "rooms";
const appToolName = (name: string) => `mcp__${APP_SERVER}__${name}`;

/** Offers a wake's app tools to the model as an in-process tool server. Nothing is started and no port is opened. */
function appServer(appTools: readonly AppTool[]) {
  return createSdkMcpServer({
    name: APP_SERVER,
    tools: appTools.map((appTool) =>
      tool(appTool.name, appTool.description, appTool.input, async (input) => ({
        content: [{ type: "text", text: await appTool.run(input) }],
      })),
    ),
  });
}

/** Room for the reads, the denied calls that follow a spent budget, and the answer. */
const TURNS_BEYOND_READS = 4;

/** The lead runtime over the Claude Agent SDK: one query() per wake. */
export function createAgentSdkRuntime(): LeadRuntime {
  return {
    wake(request) {
      const abort = new AbortController();
      const state: WakeState = { stopRequested: false, timedOut: false };

      return {
        id: newId("wake"),
        events: runWake(request, abort, state),
        stop() {
          state.stopRequested = true;
          abort.abort();
        },
      } satisfies Wake;
    },
  };
}

interface WakeState {
  stopRequested: boolean;
  timedOut: boolean;
}

async function* runWake(
  request: WakeRequest,
  abort: AbortController,
  state: WakeState,
): AsyncGenerator<WakeEvent> {
  const firstTextTimer = startFirstTextTimer(request, abort, state);
  let hasText = false;

  try {
    const messages = query({
      prompt: request.prompt,
      options: sessionOptions(request, abort),
    });

    for await (const message of messages) {
      const text = textDelta(message, hasText);
      if (text) {
        hasText = true;
        clearTimeout(firstTextTimer);
        yield { type: "text", text };
        continue;
      }

      for (const step of stepsIn(message, request)) yield step;

      const failure = failureIn(message);
      if (failure) {
        yield { type: "failed", failure };
        return;
      }

      if (message.type === "result") {
        yield { type: "finished" };
        return;
      }
    }

    // The stream ended without a result message, which only happens when it was cut.
    yield endOfCutStream(state);
  } catch (error) {
    yield state.stopRequested || state.timedOut
      ? endOfCutStream(state)
      : { type: "failed", failure: failureFromError(error) };
  } finally {
    clearTimeout(firstTextTimer);
  }
}

/**
 * A wake starts from nothing and may only read. Each line here closes one way
 * the SDK's defaults would break that (specs/conflicts.md C11 and C12).
 */
function sessionOptions(request: WakeRequest, abort: AbortController): Options {
  const sandbox = sandboxFor(request.access);
  const appTools = request.appTools ?? [];
  const appToolNames = appTools.map((appTool) => appToolName(appTool.name));

  return {
    model: LEAD_MODEL,
    effort: SDK_EFFORT[request.limits.effort],
    cwd: sandbox.cwd,
    systemPrompt: request.systemPrompt,
    abortController: abort,
    includePartialMessages: true,
    maxTurns: sandbox.budget + (appTools.length > 0 ? APP_TOOL_CALLS : 0) + TURNS_BEYOND_READS,

    // Only this wake's tools exist for it. Anything else that would ask is denied.
    tools: sandbox.tools,
    // App tools would ask before running too. They are approved here and limited by the guard.
    allowedTools: [...sandbox.allowedTools, ...appToolNames],
    permissionMode: "dontAsk",
    hooks: {
      PreToolUse: [
        { hooks: [guardHook(allowingAppTools(sandbox.guard, appToolNames, APP_TOOL_CALLS))], onFailure: "block" },
      ],
    },

    // No memory between wakes, and none of your personal Claude Code setup.
    persistSession: false,
    settingSources: [],
    // The only tool server a wake ever sees is ours, and only when it was given app tools.
    mcpServers: appTools.length > 0 ? { [APP_SERVER]: appServer(appTools) } : {},
    strictMcpConfig: true,
    env: {
      ...process.env,
      CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",
      CLAUDE_AGENT_SDK_CLIENT_APP: "conduit-rooms/0.0.0",
    },
  };
}

function guardHook(guard: ToolGuard): HookCallback {
  return async (input) => {
    if (input.hook_event_name !== "PreToolUse") return {};

    const decision = guard.check(input.tool_name, input.tool_input);
    if (decision.allow) return {};

    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: decision.reason,
      },
    };
  };
}

function startFirstTextTimer(
  request: WakeRequest,
  abort: AbortController,
  state: WakeState,
): NodeJS.Timeout | undefined {
  const timeout = request.limits.firstTextTimeoutMs;
  if (timeout === null) return undefined;

  return setTimeout(() => {
    state.timedOut = true;
    abort.abort();
  }, timeout);
}

/**
 * The text a stream event adds to the reply, if any.
 *
 * A lead can write, read a file, then write again. Those arrive as separate
 * text blocks, so a blank line is put between them to keep paragraphs apart.
 */
function textDelta(message: SDKMessage, hasText: boolean): string | null {
  if (message.type !== "stream_event" || message.parent_tool_use_id !== null) return null;

  const { event } = message;
  if (event.type === "content_block_start" && event.content_block.type === "text") {
    return hasText ? "\n\n" : null;
  }
  if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
    return event.delta.text;
  }
  return null;
}

/** One step for each tool the lead has just decided to call. */
function stepsIn(message: SDKMessage, request: WakeRequest): WakeEvent[] {
  if (message.type !== "assistant" || message.parent_tool_use_id !== null) return [];

  return message.message.content.flatMap((block): WakeEvent[] =>
    block.type === "tool_use" ? [{ type: "step", step: stepFor(block.name, block.input, request) }] : [],
  );
}

/** A call to an app tool is the step that tool says it is. Any other call is read from its name and input. */
function stepFor(toolName: string, toolInput: unknown, request: WakeRequest) {
  const appTool = request.appTools?.find((candidate) => appToolName(candidate.name) === toolName);
  return appTool
    ? appTool.step((toolInput ?? {}) as Record<string, unknown>)
    : stepOf(toolName, toolInput, request.access);
}

function failureIn(message: SDKMessage): LeadFailure | null {
  if (message.type === "assistant" && message.error) {
    return failureFromApiError(message.error);
  }
  if (message.type === "result" && message.subtype !== "success") {
    return {
      code: "runtime_error",
      message:
        message.subtype === "error_max_turns"
          ? "The lead ran out of steps before it could answer."
          : "The lead stopped with an error.",
    };
  }
  return null;
}

const AUTH_FAILURE: LeadFailure = {
  code: "auth_required",
  message:
    "Leads are not signed in. Add ANTHROPIC_API_KEY to .env.local, or sign in to Claude Code on this Mac.",
};

function failureFromApiError(error: SDKAssistantMessageError): LeadFailure {
  switch (error) {
    case "authentication_failed":
    case "oauth_org_not_allowed":
    case "cloud_credential_error":
      return AUTH_FAILURE;
    case "billing_error":
    case "account_on_hold":
    case "verification_required":
      return { code: "auth_required", message: "The Claude account needs attention before leads can reply." };
    case "rate_limit":
      return { code: "runtime_error", message: "Claude is rate limited right now. Try again in a moment." };
    case "overloaded":
    case "server_error":
      return { code: "runtime_error", message: "Claude is having trouble right now. Try again in a moment." };
    default:
      return { code: "runtime_error", message: "The lead could not finish its reply." };
  }
}

function failureFromError(error: unknown): LeadFailure {
  const text = error instanceof Error ? error.message : String(error);

  if (/not logged in|invalid api key|authentication/i.test(text)) return AUTH_FAILURE;
  return { code: "runtime_error", message: "The lead could not start." };
}

function endOfCutStream(state: WakeState): WakeEvent {
  if (state.stopRequested) return { type: "stopped" };

  return {
    type: "failed",
    failure: state.timedOut
      ? { code: "timed_out", message: "The lead took too long to start answering." }
      : { code: "runtime_error", message: "The lead's reply was cut off." },
  };
}
