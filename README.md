# conduit-rooms

A Slack-like workspace where you talk to the lead agents of your projects the way a product manager talks to colleagues. Tag a project by name in a room (`@arlo`, `@conduit`, `@hobbyist`) or message its lead in a direct chat.

The full specification lives in [`specs/`](specs/README.md). Start there.

## Status

| Milestone | State |
| --- | --- |
| M0. Ground truth | Done. See [`specs/design-tokens.md`](specs/design-tokens.md) and [`specs/conflicts.md`](specs/conflicts.md). |
| M1. Shell and project rooms | Working in development. Not yet packaged as a standalone app (see "Not done yet"). |
| M2. Common rooms | Working. Create a room and choose which projects' leads are in it. Leads take turns. Lead to lead addressing is not built. |
| M3. Who replies | Working, without flags. A tag, a project's name, or "you" after a lead spoke each pick the lead directly. Otherwise a classifier (Jev) reads each agent's persona and decides who the message is for, or that it is for nobody. |
| Hired agents | Working. Not in the original spec. Hire a CTO, a strategist, a researcher: agents that belong to no project, know every project by its brief, and can search the web. |
| Products | Working. Not in the original spec. Group several repos under one product. The product gets its own lead, brief and room. Its lead reads all of its repos, and you can tag each repo's own lead from the product's room. |
| Tools for Rooms itself | Working. Not in the original spec. Hired agents and product leads can ask a lead a question, read a brief, start briefs being written, and see a project's Conduit sessions. A project lead can see its own sessions. |
| Artifacts | Working. Not in the original spec. An agent can write a page (a comparison, a diagram, a plan) that opens in a panel inside the app, sealed off from the app and the network. |
| Starting work | Working. Ask a lead to do something and it starts a Claude session in Conduit with a brief it writes. |
| M4 and M5 | Not started. |

The sidebar no longer follows `specs/04-interface.md`. It was reshaped on 2026-11-21 and again on 2026-11-22: see rows C27 to C33 and C49 to C52 in [`specs/conflicts.md`](specs/conflicts.md).

```text
[ Find or jump          Cmd K ]   go to any room, lead, agent or session by name

Rooms                         +   one "+" makes a room, an agent or a product
  # projects
  # plugin-api
  Strategist                      an agent you hired
Projects                          each project once. What needs you first, then what is working.
  v Conduit          working      a product. Its name opens the room where its lead speaks for all its repos.
    v conduit-rooms  working      a repo. Its name opens your chat with its lead.
        session 1                 a Conduit session: open it as a chat or a terminal, and type into either
    > conduit
  v Arlo
    > arlo
      7 quiet repos  >
Quiet                 23  >       idle projects you have never talked to
```

## Run it

Needs Node 24, pnpm 11, and for the desktop window, Rust.

```sh
pnpm install
pnpm dev        # sidecar + web app, open http://localhost:1420
pnpm dev:app    # the same, inside the Tauri window
```

Leads sign in with `ANTHROPIC_API_KEY` if you put one in `.env.local` (copy `.env.example`). Without a key they use the Claude Code login already on this Mac.

```sh
pnpm test       # unit tests in every package
pnpm typecheck
```

## How it fits together

```text
apps/desktop    Tauri window + React app. Draws the screen. Owns no data.
                    |  HTTP for reads and writes, one SSE stream for live events
apps/sidecar    Node process on 127.0.0.1. Owns the database, the project
                ledger and every lead wake.
                    |  one Agent SDK query() per wake, read-only tools
                the project's repo

packages/shared The types and the HTTP contract both sides import.
```

The path of one message, file by file:

1. `apps/desktop/src/features/conversation/Composer.tsx` sends it with `useSendMessage` (`api/mutations.ts`).
2. `apps/sidecar/src/http/routes/conversations.ts` validates it and hands it to the chat service.
3. `apps/sidecar/src/chat/directChatService.ts` (a project room) or `chat/channelService.ts` (a common room) stores it and decides which lead gets a turn. `chat/leadTurns.ts` then runs that turn: brief, wake, stream, settle.
4. `apps/sidecar/src/leads/agentSdkRuntime.ts` runs the lead. `leads/repoGuard.ts` checks every file it tries to read.
5. Each piece of the reply is published on the bus (`chat/conversationBus.ts`) and sent out by `GET /api/events`.
6. `apps/desktop/src/api/workspaceEvents.ts` folds each event into the SWR cache, and the screen re-renders from the cache.

Rooms reads Conduit's project list from `~/Library/Application Support/ConduitTauri/state.json` and never writes it. Its own data lives in `~/Library/Application Support/ConduitRooms/rooms.db`.

## Design

The look comes from `~/ooozzy/conduit`: same colors, same themes, same measurements. Every token is in `apps/desktop/src/styles/theme.css`, copied from Conduit, and no color is written anywhere else. See [`specs/03-design-source.md`](specs/03-design-source.md).

## Not done yet

- **Packaging.** The Tauri shell opens the window, but the built app does not start the sidecar itself. Bundling Node and the Agent SDK's binary as a Tauri sidecar is still to do. Until then, use `pnpm dev:app`.
- **App icon.** `apps/desktop/src-tauri/icons` holds Conduit's icon as a placeholder.
- **Brief refresh** after the first one (`R-LEAD-07`). Nothing in M1 changes a ledger, so nothing triggers it yet.
- **Hired agents reading code.** By choice they see briefs only. A project you have never messaged has no brief, so a hired agent knows nothing about it until you do.
- **Folders inside one repo.** A product groups whole repos. A monorepo's `apps/` and `packages/` cannot each have a lead yet.
- **Repo leads hearing the product room unasked.** In a product's room a repo's lead speaks only when tagged. The product's lead can put a question to one with `ask_lead`, and the answer comes back to it, not into the room.
- **Seeing briefs being written in the background.** `write_briefs` starts them and nothing on screen shows their progress.
- **Asking a lead to rewrite its persona.** A lead writes its persona once. After that you edit it by hand.
- **Deleting or archiving a room.** Rooms can be created, renamed and re-staffed, not removed.
- **Lead to lead addressing** in common rooms, and the exchange cap that goes with it.
- **A live terminal connection.** The terminal view is a picture that refreshes, with your keys sent in between, so there is a short lag. It cannot be resized, and mouse input does not reach the session.
- **Chat view for agents other than Claude.** Only Claude writes the transcript Rooms reads. Other agents have the terminal view.
