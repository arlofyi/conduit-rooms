# 02. Concepts

Every term used in these specs is defined here once.

## Project

A codebase plus its ledger. A project is what you tag.

- Has a **handle**: lowercase, 2 to 32 characters, `a-z`, `0-9` and `-` only, unique across the workspace. Examples: `arlo`, `conduit`, `hobbyist`.
- Has a **display name** (for example "Hobbyist"). Shown in headers and rails. The handle is what you type.
- Has exactly one lead and exactly one ledger.
- Has an **owned surface**: the paths, services and interfaces the project is responsible for.

## Lead

The single agent role that represents a project.

- A role, not a running process. It is woken, does one thing, and stops. See `08-leads.md`.
- Speaks for its project in rooms and in its direct chat.
- Directs the project's crew outside of conversations.
- Is never addressed by its own name. You address the project: `@hobbyist`.

## Crew

Worker agent sessions that a lead starts to do the project's actual work. Each is scoped to a git worktree.

- Crew never appear in a room or a direct chat.
- Crew is optional. On a small project the lead MAY do the work itself.

## Ledger

The project's durable record. In v0 this is Continuity.

Holds: the lead's brief, the project's interests, decisions, handoffs, and notes.

- A ledger belongs to exactly one project.
- Only that project's lead (after your confirmation where required) and you may write to it.

## Brief

A short document in the ledger that a lead reads every time it wakes. It is the lead's entire starting knowledge. Format in `08-leads.md`.

## Interest

One thing a lead must protect. A project holds three to seven.

- **Type**: `contract`, `deadline`, `budget`, or `quality`.
- **Hardness**: `hard` (only you can concede it) or `soft` (the lead may trade it).
- Every interest is approved by you before it counts.

## Room

A temporary conversation between you and one or more leads, with a topic, that ends in decisions.

- Has a lifecycle: `open`, `ratifying`, `closed`. See `05-rooms.md`.
- Leads enter only by being tagged.
- A closed room is read-only forever.

## Direct chat

A permanent private conversation between you and exactly one lead. One per project. See `06-direct-chats.md`.

## Message

One entry in a room or direct chat, written by you, by a lead, or by the system.

## Mention (tag)

`@handle` inside a message. In a room it addresses that project's lead and, if the lead is not yet present, brings it in.

## Flag

A lead's raised hand. One sentence shown beside the lead in the participants rail. It is not a message and does not appear in the stream.

## Router

The deterministic component that decides, for every new message, which leads are woken. No model involved.

## Gate

A small, fast, local model that the router consults in ambiguous cases. It answers `SPEAK`, `FLAG` or `SILENT`. It cannot write a reply.

## Clerk

A neutral model call, belonging to no project, that drafts decisions from a room's transcript when you close the room.

## Decision

One outcome of a room: a single statement plus the list of projects it affects. Written to every affected ledger with the same id.

## Verdict

A lead's response to a drafted decision: `approve`, `object`, or `escalate`.

## Handoff

The work order a lead writes for its own project after a decision is dispatched. It is what the crew executes.

## Override

Your choice to dispatch a decision despite an objection or escalation. Recorded on the decision together with the objecting lead's reason.

## Invariants

These MUST hold at all times.

| # | Invariant |
| --- | --- |
| I1 | A project has exactly one lead, one ledger, one direct chat. |
| I2 | A lead is present in a room only if a message in that room tagged its project. |
| I3 | A lead's output in a room is caused by exactly one of: a tag, a tapped flag, a gate verdict of SPEAK within budget, another lead addressing it within the exchange cap, or ratification. |
| I4 | Nothing is written to a ledger from a room before Dispatch. |
| I5 | Nothing is written to a ledger from a direct chat without your explicit confirmation. |
| I6 | A direct chat writes only to its own project's ledger. |
| I7 | A decision has the same id and the same statement in every ledger it is written to. |
| I8 | A lead in a room or direct chat cannot modify any file, run any mutating command, or start crew. |
| I9 | A closed room never changes. |
| I10 | You can always proceed. No lead verdict can leave a room stuck. |
