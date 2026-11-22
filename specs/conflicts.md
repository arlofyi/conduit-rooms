# Conflicts

Where the spec disagrees with what exists, found during M0 on 2026-11-21 by reading `~/ooozzy/conduit` (commit `27df471`), `~/ooozzy/continuity-mcp` (0.1.0-alpha.6), `~/ooozzy/Experiments/conduit-code` (0.1.6) and the Claude Agent SDK docs (`@anthropic-ai/claude-agent-sdk` 0.3.330).

Status is `decided` when Uzair has ruled, `assumed` when the build proceeds on the proposed resolution until he says otherwise, `open` when nothing is settled yet.

## Foundations

| # | Spec says | Reality | Resolution | Status |
| --- | --- | --- | --- | --- |
| C1 | Q2 and `R-DS-02`: same stack as Conduit, no library Conduit does not use. | Uzair asked for TailwindCSS, HeadlessUI and SWR on 2026-11-21. Conduit uses one plain CSS file and no component library. | Frontend is React 19, Vite, TypeScript, Tailwind 4, HeadlessUI, SWR. `R-DS-02` is narrowed to fonts and icon sets. Conduit's tokens become the Tailwind theme, so `R-DS-01` still holds: every color traces to a Conduit token. | decided |
| C2 | Q1: own app or a mode inside Conduit. | Uzair chose "Tauri + Node sidecar" as the app shell on 2026-11-21, which is its own app. | Own app, own repo. Tauri 2 shell as Conduit uses, a Vite frontend in the webview, and a Node sidecar process that owns data and leads. | decided |
| C3 | The spec describes one app with a store and a runtime. | The lead runtime (C8) is a Node library. A Tauri webview cannot run it. | Three parts. `apps/desktop`: Tauri shell and React frontend. `apps/sidecar`: Node process bound to 127.0.0.1 that owns the workspace store, the ledger and lead wakes. `packages/shared`: the types and the HTTP contract both sides import. The frontend never touches disk or models. It talks to the sidecar over HTTP and server-sent events. | assumed |
| C4 | `03-design-source.md` prefers importing Conduit's tokens and components directly. | No shared package exists, and Conduit's components are bound to its CSS class names. | Tokens are copied unchanged into the Tailwind theme with a header naming the source commit (option 2). Components are rebuilt on HeadlessUI to match Conduit's measurements in `design-tokens.md` (option 3, forced by C1). | assumed |

## Ledger

| # | Spec says | Reality | Resolution | Status |
| --- | --- | --- | --- | --- |
| C5 | The ledger is Continuity. Briefs, interests, decisions, handoffs and notes live there. | The product with decisions and handoffs is `continuity-mcp`, not `~/ooozzy/continuity` (an unrelated desktop app). It has no brief, no interests, no notes. | The ledger is a local SQLite store owned by the sidecar, one logical ledger per project, behind the ledger adapter in `10-data-model.md`. Continuity becomes a mirror target, not the store. | assumed |
| C6 | A decision has the same id in every ledger (I7), with rationale, affected projects, verdicts and override. | `continuity-mcp` generates decision ids itself. The only caller key is `decision_key`, unique across the whole machine. It stores one free text `content` field. | Rooms' own ledger keeps the full decision. On dispatch (M4) each decision is also mirrored to Continuity with `decision_key = {handle}.{dec_id}` and the statement as content, so other Claude sessions in that repo see it. Mirror failure never blocks dispatch. | assumed |
| C7 | Handoffs have a title, a result and the statuses `queued`, `running`, `done`, `failed`, `cancelled`. | Continuity handoffs have `context` only, statuses `pending`, `accepted`, `completed`, `expired`, no result, and need a live session id to create. | Handoffs live in Rooms' ledger. No Continuity mirror in v0. Revisit in M5. | assumed |
| C8 | Only that project's lead and you may write to a ledger. | Continuity's database is one file for every repo on the machine, and Conduit only ever reads it. | Rooms never writes Continuity's SQLite file directly. The mirror in C6 goes through the `continuity-mcp` backend interface. | assumed |

## Lead runtime

| # | Spec says | Reality | Resolution | Status |
| --- | --- | --- | --- | --- |
| C9 | `08-leads.md`: v0 implements the runtime adapter over Conduit Code. | Conduit Code is a terminal UI only: no print mode, no stream output, no prompt argument. Uzair ruled "Agent SDK, not the claude cli" on 2026-11-21. | `wake` and `stop` are implemented over the Claude Agent SDK: one `query()` per wake, `includePartialMessages` for streaming, an `AbortController` for stop. The adapter interface is unchanged. | decided |
| C10 | "A lead SHOULD be built on Conductor sessions if possible." | A Conductor is a long-lived interactive terminal session that drives workers over an MCP server. That is the opposite of `R-LEAD-01` (no state survives between wakes). | Leads are not Conductors. Conductor and `fleet_spawn` are the candidate crew mechanism for M5 only. | assumed |
| C11 | `R-LEAD-01`: nothing survives between wakes. | By default the Agent SDK writes a session transcript to `~/.claude/projects/`, loads user and project settings, and loads auto memory. | Every wake sets `persistSession: false`, `settingSources: []`, `strictMcpConfig: true` and `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`. The system prompt is ours, not the Claude Code preset. | assumed |
| C12 | `R-LEAD-15`: limits enforced by tools, not prompt. `R-ROOM-11`: a lead cannot read another project's repo. | In the SDK, `allowedTools` only pre-approves. It does not restrict. A bare `Read` entry would approve reads anywhere on disk. | Three layers. `tools: ["Read", "Glob", "Grep"]` removes every other built-in tool. `permissionMode: "dontAsk"` with no bare allow rule: reads inside the working directory need no approval, anything else is denied. A `PreToolUse` hook resolves each path and denies any that leaves the project root, because hook denials hold in every mode. Verified by the M1 and M2 acceptance checks. | assumed |
| C13 | `R-LEAD-16`: at most 8 read calls and 30 seconds before the first token. | The SDK has `maxTurns` but no read counter. | The same `PreToolUse` hook counts calls and denies the ninth with a message telling the lead to answer with what it has. A 30 second timer aborts a wake that has produced no text. | assumed |
| C14 | Q4: leads use whatever model Conduit Code is configured with. | Not applicable after C9. | Leads run on `claude-opus-5-5`, set in one constant in the sidecar. Model names never appear on screen. | assumed |
| C15 | The spec does not mention credentials. | The SDK reads `ANTHROPIC_API_KEY`, or falls back to the Claude Code login on the machine. Uzair chose "Support both" on 2026-11-21. | The sidecar loads `ANTHROPIC_API_KEY` from a gitignored `.env.local` when present, otherwise passes none and the bundled binary uses the local login. A wake that fails on auth surfaces as a setup state in the UI, not a generic error. | decided |

## Projects

| # | Spec says | Reality | Resolution | Status |
| --- | --- | --- | --- | --- |
| C16 | "Read projects from Conduit." | Projects live in `~/Library/Application Support/ConduitTauri/state.json`, key `projects`, in display order. A second writer corrupts Conduit's state. | The sidecar reads that file and never writes it. Handles and anything else Rooms adds live in Rooms' own store, keyed by Conduit's project id. | assumed |
| C17 | `R-UI-20`: lead avatar is the project icon if Conduit has one. | Conduit has no project icon. It has an optional `color`, otherwise a color computed by `projectAccent` (`src/layout.ts:87`). | Avatar is the first letter of the display name on a tint of the project's Conduit color, using the same `projectAccent` rule when `color` is unset. | assumed |
| C18 | Handles are unique slugs of the project name. | Names are not unique in principle and paths are not deduplicated. Real names include `milega.pk` (a dot) and `t4p-hub`. | Slug rule: lowercase, anything outside `a-z0-9` becomes `-`, collapse repeats, trim to 32. On collision append `-2`, `-3`. Stored and editable (Q17). | assumed |
| C19 | "Every project in Conduit appears under Direct." | The live file has 33 projects. | No change to the rule. The sidebar sections scroll, and Direct sorts never-messaged projects to the bottom as `R-UI-04` already says. | assumed |

## Interface

| # | Spec says | Reality | Resolution | Status |
| --- | --- | --- | --- | --- |
| C20 | `R-UI-18`: no chat bubbles, no right-aligned messages. | Conduit's chat surfaces put your messages in a right-aligned accent bubble (`.hq-bubble-user`). The README says Conduit wins on looks, the spec on behavior. | Treated as behavior: a room has several speakers, so one uniform left-aligned row is the only layout that reads. Type, color and spacing still come from Conduit's chat styles. | assumed |
| C21 | Sidebar 240px, rail 280px, minimum window 960px. | Conduit: sidebar 232px (resizable, minimum 200), right panel 300px, minimum window 980 x 600. | Conduit's values win (`R-DS-03`). | decided by spec |
| C22 | Brief sheet uses Conduit's side sheet. Ratify sheet uses Conduit's sheet. | Conduit has a right drawer (`.session-drawer`) and a centred modal, but no bottom sheet. | Brief sheet follows the drawer. Ratify sheet is new, built from the modal surface, docked to the bottom of the centre column. | assumed |
| C23 | Tooltips, for example "Dismiss" on a flag. | Conduit has no tooltip component. It uses the native `title` attribute. | Use `title`, as Conduit does. | assumed |
| C24 | Semantic "info" color. | Conduit has success, warning and danger only. | Info uses `--text-mid` for text and `--accent` for emphasis, as Conduit's `Notice` does. | assumed |
| C25 | Cmd+K quick switcher, Cmd+N new room. | Not yet checked against Conduit's own bindings. | Verify when the keyboard layer is built in M2. | open |

## Information architecture

Uzair reviewed the first build on 2026-11-21 and replaced the spec's sidebar (Projects, Direct, Rooms) with the structure below. These rows override `04-interface.md`, `05-rooms.md` and `06-direct-chats.md` where they differ.

| # | Spec says | Ruling | What it means in the build | Status |
| --- | --- | --- | --- | --- |
| C27 | Sidebar sections: Projects, Direct, Rooms. Every project listed under both Projects and Direct. | Three sections: **Common rooms**, **Project rooms**, **Projects**. Drawn as Conduit draws its sidebar: section labels, folder rows with a disclosure arrow, sessions nested on an indent guide, accent "Add" rows. | `apps/desktop/src/features/shell/Sidebar.tsx`. | decided |
| C28 | A room is temporary: created with a topic, closed into decisions. | **Common rooms are permanent channels, like Slack.** You create them, name them, and they are never closed. | Table `rooms`. `apps/sidecar/src/http/routes/rooms.ts`, `apps/sidecar/src/chat/channelService.ts`. Ratification (`09-negotiation.md`) has no home yet and needs rethinking before M4. | decided |
| C29 | A lead enters a room only when tagged in it (I2). A room holds at most 4 leads (`R-ROOM-06`). | **You choose who is in each room** when you create it, and can change that later: "two to four agents out of 15 projects". Tagging decides who speaks, not who is present. Only members can be tagged. | Table `room_members`. "New room" and "Members" open `apps/desktop/src/features/room/RoomDialog.tsx`. No cap on members is enforced. `#projects` was the first, built-in room: it is now an ordinary room, with the members and messages it had. | decided |
| C30 | Every project has a direct chat listed in the sidebar. | **Project rooms are opt-in.** You add the ones you want with "Add room". The spec's "direct chat" is the same thing and the code keeps that name. | `direct_chats.added_at`. A project room still exists for every project (I1). Only its listing is opt-in. | decided |
| C31 | The Projects section opens a project's direct chat. | **Projects is the watch side.** Each project shows a status and, nested under it, Conduit's live sessions with their status. Read-only. | Read from Conduit's `state.json` (`agentState`, `stopped` per session), polled every 4 seconds at `GET /api/activity`. Nothing is stored. Status rule in `packages/shared/src/activity.ts`. | decided |
| C32 | Participants rail on the right of a room. | Not built. Members and their status show in the room's header. | `apps/desktop/src/features/channel/ChannelView.tsx`. Revisit when flags arrive in M3, since a flag needs somewhere to sit. | assumed |
| C33 | A lead that mentions another lead gets an answer, up to an exchange cap (`R-SP-06`, `R-SP-21`). | Not built. Only your tags wake a lead. | A lead's own "@handle" draws as a pill and wakes no one. | open |

| C34 | Crew never appear in Rooms (`02-concepts.md`). Tool calls and crew output are never on screen (P7). | **A session can be opened as a chat or as a terminal, as in Conduit, and you can type into both.** | `apps/desktop/src/features/session/`. Chat reads the transcript Claude writes (`apps/sidecar/src/sessions/transcript.ts`) and sends a message as a bracketed paste plus Enter. Terminal reads the session's tmux screen with `capture-pane`, draws it with xterm.js, and sends each keystroke with `send-keys` (`sessions/terminal.ts`). Rooms never attaches to the tmux session, so opening one cannot resize it in Conduit. The terminal is therefore a refreshed picture with a short input lag, not a live connection. P7 still holds for rooms. | decided |
| C35 | I8: a lead in a conversation cannot run any mutating command. `R-DATA-01`: only model calls leave the sidecar. | Typing into a session is command execution on this machine, done by you, not by a lead. | `POST /api/sessions/:id/message` and `/input`. Guarded like every route (127.0.0.1 only, per-boot token, origin check) and limited to session ids Conduit lists. No lead has a tool that reaches these routes. | decided |

## Hired agents

Uzair on 2026-11-22: "Currently we can have per project agents, but I would like additional agents. Like a CTO that is always available for me to talk to, a strategist that has an idea of all my projects. Researchers, etc. But I get to make/hire them." This overrides principle P8 (one project, one lead) and the non-goal "custom personas for leads".

| # | Spec says | Ruling | What it means in the build | Status |
| --- | --- | --- | --- | --- |
| C40 | P8: one project, one lead, one ledger. Every agent you talk to is a project's lead. | **You can hire agents that belong to no project.** They have a room of their own, can be put in common rooms, tagged, and picked by the gate from their persona. | Stored as rows of `projects` with `kind = 'hired'`, plus `hired_agents` for their instructions, so rooms, members, messages, handles and personas work for them unchanged. See the note on `Project` in `packages/shared/src/entities.ts`. | decided |
| C41 | `R-LEAD-13`: a lead never sees another project's brief. | **A hired agent knows every project through its brief**: the Purpose and State sections, cut to fit. It cannot open any file in any repo. A project nobody has talked to has no brief, and is listed to the agent as "nothing is known". | `apps/sidecar/src/leads/knowledge.ts`. Project leads are unchanged: each still sees only its own brief. | decided |
| C42 | Q14: no agent browses the web in v0. | **Every hired agent can search the web and read pages.** Project leads still cannot. | A wake now states its access explicitly: `repo` (read one repo) or `web` (search and fetch). Tools, working folder and guard are chosen together in `sandboxFor()`, `apps/sidecar/src/leads/agentSdkRuntime.ts`. A hired agent runs in an empty folder with no file tool. Limit: 8 lookups per reply. | decided |
| C43 | Non-goal: custom personas for leads. | **Hiring is: a name and a sentence or two, then a draft of its instructions and persona that you edit, then Hire.** Both stay editable afterwards. An agent can be let go. Its messages stay and its handle is freed. | `apps/desktop/src/features/agent/HireDialog.tsx`, `apps/sidecar/src/leads/hiring.ts`, routes in `http/routes/agents.ts`. | decided |

## Products

Uzair on 2026-11-22: "Can we get sub-folders? So each folder can get its own brief?" Then: "all the projects that currently exist in the sidebar are repos. However, multiple repos can be under the same product", and on who speaks: "Both, one lead, multiple sub-leads that I can tag."

| # | Spec says | Ruling | What it means in the build | Status |
| --- | --- | --- | --- | --- |
| C44 | A project is the unit: one repo, one lead, one ledger (P8). | **A product groups several repos under one name and has a lead of its own.** Each repo keeps its lead, its room and its brief. A repo is under one product at most. You make, change and take apart products yourself. Conduit knows nothing of them. | A third kind of row in `projects` (`kind = 'product'`), with `product_id` on each repo under it and a `products` table for when its repos last changed. `apps/sidecar/src/store/products.ts`, routes in `http/routes/products.ts`, `apps/desktop/src/features/product/ProductDialog.tsx`. Rebuilding `projects` to allow the third kind is migration 6, which also drops the CHECK on `kind`. | decided |
| C45 | I8, `R-ROOM-11`: a lead reads its own repo and nothing else. `R-LEAD-13`: a lead never sees another project's brief. | **A product's lead reads every repo under its product, and is handed what each of those repos' briefs says.** It still cannot read a repo outside the product. Repo leads are unchanged. | `WakeAccess` of kind `repo` now carries a list of folders. `accessFor()` in `apps/sidecar/src/leads/access.ts` decides it per speaker, and `createRepoGuard` checks each path against every folder. `reposDigest()` in `leads/knowledge.ts`. | assumed |
| C46 | `R-LEAD-11`: a lead writes its first brief from its repo. | **A product has a brief of its own**, written by its lead from its repos' briefs: purpose, state, the part each repo plays, how they fit together. A repo with no brief gets one first. The product brief is written again when you change which repos the product has. | `apps/sidecar/src/leads/briefs.ts`, format in `leads/prompts.ts`. First message to a new product therefore takes about a minute, more if its repos have no briefs yet. | decided |
| C47 | A project room has one lead (`R-DM-03`). | **In a product's room its lead answers, and the lead of a repo under it answers when you tag it.** Nothing else picks a repo lead there: no names, no gate. A product is often named after one of its repos, and "arlo" should not wake two leads. | The product's room runs on the common room service with the product lead as `host`: `productRoom()` in `apps/sidecar/src/http/conversation.ts`, `send()` in `chat/channelService.ts`. In common rooms a product lead is an ordinary member, tagged, named or picked by the gate like any other. | decided |
| C48 | The sidebar lists projects flat (C27 to C33). | **Repos under a product are drawn nested beneath it**, in Project rooms (under the product's own room) and in Projects (under its name). | `groupByProduct()` in `apps/desktop/src/features/workspace/`, `ProductRooms.tsx` and `Sidebar.tsx` in `features/shell/`. | decided |

## Sidebar, second reshaping

Uzair on 2026-11-22, on the four-section sidebar with products in it: "We need to improve the sidebar. Think outside the box." Shown four directions, he chose the recommended one: one tree, with search and with one row for both talking and watching.

| # | Spec says | Ruling | What it means in the build | Status |
| --- | --- | --- | --- | --- |
| C49 | C29 and C30: "Project rooms" to talk and "Projects" to watch are separate sections, and you add the rooms you want. | **Each project is listed once.** Its name opens your room with its lead. Its arrow shows its Conduit sessions. There is no "Add room": a project is listed once it is busy or once you have talked to it. | `ProjectRow.tsx` and `ProductRow.tsx` in `apps/desktop/src/features/shell/`. The watch view of a project is reached from its room's "Sessions" button. `direct_chats.added_at` is still read but nothing in the sidebar sets it for a project any more. | decided |
| C50 | The sidebar lists every project, in Conduit's order. | **What needs you comes first, then what is working, then your most recent chats.** Projects that are idle and that you have never talked to fold into one "Quiet" line. Inside a product the same split applies to its repos. | `arrangeSidebar()` in `features/shell/arrangeSidebar.ts`, with tests. The order changes as sessions start and stop, by design. | decided |
| C51 | Nothing. | **Cmd+K jumps to anything by name**: a room, a lead, an agent, a Conduit session. | `apps/desktop/src/features/jump/`. Typing a product's name also finds the repos and sessions under it. | decided |
| C52 | Each section ends in its own "add" row. | **One "+"**, beside Rooms, makes a room, an agent or a product. Agents are listed with the rooms. | `features/shell/AddMenu.tsx`. | decided |

## Replies in progress

Uzair on 2026-11-22: "is there a way to show progress for a response too? I know the agent is doing tool_calls". Shown four drawn options, he chose the trail that folds, with pieces of the others.

| # | Spec says | Ruling | What it means in the build | Status |
| --- | --- | --- | --- | --- |
| C53 | A reply in progress shows a typing indicator (`R-UI-27`). Nothing records how a reply was made. | **Each lookup a lead makes is a step, shown as it happens and kept with the message.** Before the lead writes, steps stack up. Once it writes they fold into one line ("Searched once, read 2 files, 14s") that opens on a click. A reply that looked nothing up says "Answered from its brief". One that spent all 8 lookups says so. | `ReplyStep` and its wording in `packages/shared/src/steps.ts`. `messages.steps` and `messages.took_ms` (migration 7). Event `message.step`. `apps/sidecar/src/leads/stepOf.ts`, `apps/desktop/src/features/conversation/ReplyTrail.tsx`. Replies from before this have no steps and show no line. | decided |
| C54 | Joining is one word beside the lead (`R-LEAD-11`). | **Joining says what is being read. A product's lead shows every repo under it as a tile**: waiting, reading (with the file), brief written. | Event `lead.joining` carries a whole `JoinProgress` each time, so a missed one does no harm. `apps/sidecar/src/leads/briefs.ts`, `JoiningRow` in `features/conversation/StreamRows.tsx`. Not stored. | decided |

## Tools for Rooms itself

Uzair on 2026-11-22, after his Strategist said it could not write briefs: "Do the agents have available tool-calls for the app itself?" Told no, and offered four with defaults, he said: "Yes, build all four with those defaults".

| # | Spec says | Ruling | What it means in the build | Status |
| --- | --- | --- | --- | --- |
| C55 | A lead's tools are Read, Glob and Grep (C12). A hired agent's are web search and fetch (C42). | **Four tools for Rooms itself**: `ask_lead` (put a question to a lead and get its answer), `write_briefs` (have leads with no brief write theirs, in the background), `read_brief` (a whole brief), `list_sessions` (what Conduit is running in a project). | `apps/sidecar/src/leads/appTools.ts`. Offered to the model as an in-process tool server (`createSdkMcpServer`), approved by name and limited by the same `PreToolUse` guard, with a budget of 6 calls per reply beside the 8 lookups. Each call is a step in the reply's trail. | decided |
| C56 | P8: a lead speaks only for its project. | **A hired agent and a product's lead get all four, for any project. A project's lead gets `list_sessions` for its own project only.** | `AppTools.for()`. So a project lead still cannot reach another project. | decided |
| C57 | Leads addressing each other is capped by an exchange limit (`07-speaking-policy.md`). | **A lead woken by `ask_lead` has no app tools**, so it answers and cannot ask onward: depth one. Its answer goes back to the asker and is not posted in any room. `write_briefs` starts at most 10 per call and writes 3 at a time. | `ask()` and `queueBriefs()` in `appTools.ts`. A reply that may ask a lead is given 180 seconds to produce its first word instead of 30. | decided |
| C58 | Nothing tells a lead how Rooms works. | **Every speaker is told, in one paragraph**: what a project, a product, a lead, a brief and a handle are, and that nobody here can change code. | `HOW_ROOMS_WORKS` in `apps/sidecar/src/leads/prompts.ts`. Before it, an agent asked to write briefs guessed at how briefs come about. | decided |

## Session chat

Uzair on 2026-11-22, pointing at one long Claude session: "For session chats, we need to ensure that we format everything correct so that Claude sessions live on the page correctly." Then, of `★ Insight` blocks: "Using regex format these too."

| # | Spec says | Ruling | What it means in the build | Status |
| --- | --- | --- | --- | --- |
| C59 | Nothing. The session chat view is itself outside the spec (C34). | **A Claude session is drawn as turns.** Everything Claude does between two things you said is one block with one name, and each run of tool calls inside it folds to a line ("7 steps: Bash 4, Read 2"). A command is described by what Claude said it was for. A connector's tool is named plainly. | `groupTranscript()` in `apps/desktop/src/features/session/`, `toolItem()` in `apps/sidecar/src/sessions/transcript.ts`. | decided |
| C60 | Nothing. | **Three things Claude records oddly are shown for what they are.** A compaction summary is one line across the page, not pages of text under your name. An answer you chose when Claude asked you a question is shown as something you said. Where you stopped Claude is marked. Pictures sent with a message are counted. | `itemsOf()` in `transcript.ts`: `isCompactSummary`, `toolUseResult.answers`, the interruption marker, and image blocks. Pictures are counted, not drawn. | decided |
| C61 | Nothing. | **An `★ Insight` block is drawn as a card**, found by a regular expression that accepts the block with or without backticks and with its closing rule on its own line or run on after the text. | `splitInsights()` in `apps/desktop/src/lib/markdown.ts`, `components/Markdown.tsx`. Used in session chat. Leads are told not to write such blocks, so room messages do not use it. | decided |
| C62 | Nothing. Typing into a session is itself outside the spec (C35). | **A message to a Claude session can carry pictures**: by a button, by paste, or by dropping them on the box. Up to 6, 5 MB each, PNG, JPEG, GIF or WebP. | The sidecar writes each to the temporary folder and pastes its path into the session before the text, which is how Conduit itself hands Claude a pasted picture (`src-tauri/src/clipboard.rs` there). `apps/sidecar/src/sessions/images.ts`, `sendMessage()` in `sessions/terminal.ts`, `useImageAttachments.ts` and `ComposerBox.tsx` in `apps/desktop/src/features/conversation/`. Offered for Claude sessions only. Rooms with leads do not take pictures yet. | decided |

## Answering together

| # | Spec says | Ruling | What it means in the build | Status |
| --- | --- | --- | --- | --- |
| C63 | Lead turns in a room are sequential, so each lead reads the reply before it (`R-ROOM-21`). | **The spec stands.** Uzair asked on 2026-11-22 whether `@all` could wake everyone at once. It was built, and he had it reverted the same day on seeing the cost: leads answering together cannot read each other. | Nothing. One lead writes at a time in a room, as before. Do not offer this again without a way for leads to see each other's replies. | decided |

## Answering again

Uzair on 2026-11-22, after a reply did not show on screen: "Add a rerun button to each message."

| # | Spec says | Ruling | What it means in the build | Status |
| --- | --- | --- | --- | --- |
| C64 | Only a failed reply can be retried (`R-UI-30`). | **A message can be answered again.** On a message of yours: whoever it is for answers once more. On a lead's reply: that reply is dropped and the lead writes it afresh. The button shows on your latest message and the replies after it, not on older ones: a lead always answers the conversation as it now stands, so "answer this old message again" would answer the newest one. | `rerun()` in `chat/channelService.ts` and `chat/directChatService.ts`, route `POST .../messages/:id/rerun`, which replaces the old retry route. `currentExchangeStart()` in `apps/desktop/src/features/conversation/MessageStream.tsx`. | assumed |

## Artifacts

Uzair on 2026-11-22: "Can we include in-app artifacts? So an agent can write an artifact, open an in-app browser to show the artifact?"

| # | Spec says | Ruling | What it means in the build | Status |
| --- | --- | --- | --- | --- |
| C65 | A lead produces text and nothing else. Message bodies allow a subset of Markdown (`R-UI-23`). | **An agent can write a page**: a whole HTML document, for something better seen than read. The reply shows a card for it, and the card opens the page in a wide panel inside the app. Every speaker has the tool, project leads included. | Tool `write_artifact` in `apps/sidecar/src/leads/appTools.ts`, table `artifacts` (migration 8), routes in `http/routes/artifacts.ts`, event `artifact.created`. `apps/desktop/src/features/artifact/`. A page is dropped with its reply if the reply is answered again. Pages cannot be edited or listed on their own yet. | decided |
| C66 | Nothing. | **A page is someone else's code, so it is drawn sealed.** It can run scripts. It cannot reach the app, the sidecar, your files or the network. | Two locks. The frame is sandboxed with scripts only, which gives the page an origin of its own. `sealArtifact()` in `apps/desktop/src/lib/` puts a content security policy first in the page: inline code, Google Fonts, and scripts from cdnjs, jsDelivr and unpkg, and no request of the page's own. | assumed |

## Starting work

Uzair on 2026-11-22, after a lead answered "spawn it" with "I can't start a session from here": "if we're making Conduit Rooms, it should be able to start sessions too. It makes no sense to not do that."

| # | Spec says | Ruling | What it means in the build | Status |
| --- | --- | --- | --- | --- |
| C67 | A lead cannot start work. Handing work to crew is M5, behind a handoff you approve (`09-handoffs.md`). | **A lead starts the session itself when you ask for the work**: "do it", "go for it", "spawn it". No card to approve first. It writes the brief, the session starts in Conduit, and the reply shows a card that opens it. | Tool `start_session` in `apps/sidecar/src/leads/appTools.ts`. A project's lead starts sessions in its own project, a product's lead in the repos under it, a hired agent in any. At most 3 per reply. Leads are told to start one only when asked for the work, and otherwise to answer and offer. | decided |
| C68 | Rooms never writes to Conduit (C6). | **Rooms asks Conduit to start the session, over Conduit's own local API**, and still writes nothing of Conduit's. | `POST /open` on the port in Conduit's `hook-endpoint.sh`, with the token in its `cli-token`: the API behind Conduit's `conduit` command. `apps/sidecar/src/conduit/startSession.ts`. The brief goes as a temporary file Conduit reads, removed afterwards. Conduit returns no session id, so a card finds its session by name. Sessions run Claude. | decided |

## Gate

Uzair on 2026-11-21, on seeing "No project was tagged": "this is the wrong approach. what I asked for is a classifier for each agent to decide if they should reply". Then: "consider adding Jev", and "the reason you miss is because a Project Agent does not have a Persona".

| # | Spec says | Ruling | What it means in the build | Status |
| --- | --- | --- | --- | --- |
| C26 | Q3: a local model runs the gate. | **Jev**, TypeSafe's classifier, when `TYPESAFE_API_KEY` is set. A local Ollama model (`qwen3:8b`) otherwise. | `apps/sidecar/src/leads/jevGate.ts`, `leads/gate.ts`. With Jev, the message and the persona leave the machine for api.typesafe.ai, which the spec's local gate was meant to avoid (`R-SP-15`). | decided |
| C36 | The router wakes addressed leads, and consults the gate only on an ownership match (`07-speaking-policy.md`). | Four steps, cheapest first: a tag, then a project named in plain words ("Conduit, are you busy?"), then "you" said right after a lead spoke ("is anything pending on you?"), then the gate. The first three are string checks and never involve a model. | `send()` in `apps/sidecar/src/chat/channelService.ts`, with `taggedMembers`, `namedMembers` and `leadSpokenTo`. No ownership pre-filter before the gate. | decided |
| C37 | The gate reads the brief's owned surface and keywords (`R-SP-04`). | **Each project agent has a Persona**: a few lines, written for the gate, saying what the agent is and what to ask it about, in the words a person would use. | Ledger table `personas`, versioned like briefs. Drafted by the project's own lead from its brief (`leads/personas.ts`) when the project joins a room, and editable by you. | decided |
| C38 | Gate verdicts are SPEAK, FLAG, SILENT. Unprompted SPEAK is capped at 1 per lead per room. | SPEAK or SILENT only. No flags, no cap. | Flags need a place to show, and the cap would stop a room behaving like a conversation. Both can return if leads start talking too much. | assumed |
| C39 | The gate is asked about each lead separately (`R-SP-14`). Its accuracy is a target, not measured. | The gate is asked once per message, about every member together: "which of these is it for?", each lead an option described by its persona, plus "nobody". Two more questions ride in the same call: is it for the whole group, and is it a follow-up to what was just said. | `apps/sidecar/src/leads/jevGate.ts`, rule in `pick()`. Asked about each lead alone, Jev scored 26 of 32 on the real `#projects` room, and the wrong lead often scored higher than the right one. Asked to choose between them it scored 33 of 33 (2026-11-21, median 0.3 seconds, two members). That set is also what the two thresholds in `pick()` were set against, so it is not a held-out result. Every decision is logged as a `gate_called` event with its probabilities. | decided |
