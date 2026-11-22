# 10. Data model

Field types are abstract (`id`, `string`, `text`, `enum`, `timestamp`, `int`, `bool`, `list`). Map them to whatever storage Conduit and Continuity already use. Where either already has an equivalent entity, reuse it and record the mapping in the table at the end.

## Where things live

| Store | Holds | Owner |
| --- | --- | --- |
| Workspace store | Rooms, messages, flags, room events, direct chats, drafts, UI state | Conduit Rooms (local, same storage technology as Conduit) |
| Project ledger | Brief and its versions, interests, decisions, handoffs, notes | Continuity, one ledger per project |

- `R-DATA-01` Everything is local to the machine. The only network traffic is model calls made by the runtime.
- `R-DATA-02` Transcripts stay in the workspace store and are never copied into a ledger. Ledgers receive only decisions, handoffs, notes, interests and briefs.

## Identifiers

- `R-DATA-03` Every entity id is a prefixed, sortable unique id: `proj_`, `room_`, `dm_`, `msg_`, `flag_`, `dec_`, `ver_`, `hof_`, `int_`, `note_`, `evt_`, `wake_`.
- `R-DATA-04` Ids are generated locally and never reused.

## Workspace store

### Project (reference)

Read from Conduit. Conduit Rooms adds only what it needs.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | id | Conduit's project id |
| `handle` | string | Unique, 2 to 32 chars, `a-z0-9-`. Defaults to a slug of the project name. Editable. |
| `display_name` | string | From Conduit |
| `repo_path` | string | From Conduit |
| `ledger_ref` | string | How to reach this project's ledger in Continuity |

### Room

| Field | Type | Notes |
| --- | --- | --- |
| `id` | id | |
| `topic` | string | 3 to 120 chars |
| `status` | enum | `open`, `ratifying`, `closed` |
| `participants` | list of project id | In join order. At most 4. |
| `created_at` | timestamp | |
| `last_activity_at` | timestamp | Drives sidebar order |
| `closed_at` | timestamp or null | |
| `continued_from` | room id or null | Set by "Continue in new room" |
| `ratify_round` | int | Informational |

### DirectChat

| Field | Type | Notes |
| --- | --- | --- |
| `id` | id | |
| `project_id` | id | Unique. One per project. |
| `last_activity_at` | timestamp | |

### Message

| Field | Type | Notes |
| --- | --- | --- |
| `id` | id | |
| `conversation_id` | id | A room or a direct chat |
| `author_kind` | enum | `user`, `lead`, `system` |
| `author_project_id` | id or null | Set when `author_kind` is `lead` |
| `body` | text | Markdown subset. For system rows, the rendered copy. |
| `mentions` | list of project id | Parsed at send time. `@all` is expanded to the leads present at that moment. |
| `status` | enum | `streaming`, `complete`, `stopped`, `failed` |
| `wake_id` | id or null | The lead wake that produced it |
| `wake_reason` | enum or null | See `08-leads.md` |
| `system_kind` | enum or null | For system rows: `joined`, `join_failed`, `untagged_hint`, `paused`, `closing`, `back_to_discussion`, `decided`, `closed`, `note_saved`, `handoff_sent`, `continued_from` |
| `card` | object or null | A note or handoff proposal attached to a direct chat message, with its state |
| `created_at` | timestamp | |
| `edited_at` | timestamp or null | Only your own messages, per `R-ROOM-13` |

### Flag

| Field | Type | Notes |
| --- | --- | --- |
| `id` | id | |
| `room_id` | id | |
| `project_id` | id | |
| `line` | string | At most 120 chars |
| `interest_id` | id or null | |
| `trigger_message_id` | id | The message that caused it |
| `status` | enum | `open`, `tapped`, `dismissed`, `superseded`, `spoken`, `unheard` |
| `created_at`, `resolved_at` | timestamp | |

`unheard` is set at dispatch on flags that were still open.

### DraftDecision (ratifying only)

Exists only while a room is `ratifying`. Deleted on "Back to discussion". On dispatch, accepted drafts become Decisions in ledgers and the drafts are kept in the room as the closed summary.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | id | Becomes the Decision id on dispatch |
| `room_id` | id | |
| `statement` | text | |
| `rationale` | string | One line |
| `affected` | list of project id | |
| `source_message_ids` | list of id | |
| `round` | int | 0, 1 or 2 (`R-NEG-18`) |
| `resolution` | enum | `pending`, `accepted`, `dropped` |
| `origin` | enum | `clerk`, `user`, `counter` |

### Verdict

| Field | Type | Notes |
| --- | --- | --- |
| `id` | id | |
| `draft_decision_id` | id | |
| `round` | int | |
| `project_id` | id | |
| `verdict` | enum | `approve`, `object`, `escalate`, `none` |
| `interest_id` | id or null | Required for `object` and `escalate` |
| `reason` | string or null | One sentence |
| `counter` | text or null | Replacement statement |
| `traded_interest_id` | id or null | For an approve that trades a soft interest |
| `invalid_note` | string or null | Set when an objection was converted per `R-NEG-14` |

### RoomEvent (append-only log)

Every state change and every routing decision. This is the audit trail and the tuning dataset.

| Field | Type |
| --- | --- |
| `id`, `conversation_id`, `at` | id, id, timestamp |
| `kind` | enum, below |
| `data` | object, shape per kind |

Kinds: `room_created`, `topic_renamed`, `lead_joined`, `lead_join_failed`, `message_sent`, `route_decision`, `gate_called`, `wake_started`, `wake_finished`, `wake_failed`, `wake_stopped`, `flag_raised`, `flag_resolved`, `cap_reached`, `close_requested`, `decisions_drafted`, `verdicts_requested`, `verdict_received`, `decision_resolved`, `returned_to_discussion`, `dispatch_started`, `ledger_write_ok`, `ledger_write_failed`, `dispatched`, `room_closed`, `handoff_created`, `handoff_status`, `note_saved`, `brief_refreshed`.

`route_decision.data`: `message_id`, `project_id`, `outcome`, `rule` (`addressed`, `no_match`, `gate`, `budget_downgrade`, `one_lead_room`, `addressed_by_lead`, `cap`), `matched_terms`.

`gate_called.data`: `message_id`, `project_id`, `verdict`, `line`, `interest_id`, `latency_ms`, `failed`.

- `R-DATA-05` The event log is never edited or deleted, including for closed rooms.

## Project ledger

### Brief

| Field | Type | Notes |
| --- | --- | --- |
| `project_id` | id | |
| `version` | int | Increments on every write |
| `body` | text | Markdown, format in `08-leads.md` |
| `written_at` | timestamp | |
| `written_by` | enum | `lead`, `user` |

### Interest

| Field | Type |
| --- | --- |
| `id`, `project_id` | id |
| `statement` | text |
| `type` | enum: `contract`, `deadline`, `budget`, `quality` |
| `hardness` | enum: `hard`, `soft` |
| `status` | enum: `proposed`, `approved`, `retired` |
| `approved_at`, `retired_at` | timestamp or null |
| `last_override` | object or null: `decision_id`, `room_topic`, `at` |

### Decision

Written identically to every affected project's ledger.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | id | Same in every ledger (invariant I7) |
| `statement` | text | Same in every ledger |
| `rationale` | string | |
| `affected` | list of project handle | |
| `source` | enum | `room`, `direct` |
| `source_room_id`, `source_room_topic` | id, string or null | |
| `decided_at` | timestamp | |
| `verdicts` | list | Per affected project: handle, verdict, interest statement, reason, counter |
| `override` | bool | True if accepted against an object, escalate or missing verdict |
| `supersedes` | decision id or null | Set by hand when a later decision replaces an earlier one |

### Handoff

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `project_id` | id | |
| `decision_id` | id or null | Null for a handoff from a direct chat with no decision |
| `title` | string | |
| `work_order` | text | |
| `status` | enum | `queued`, `running`, `done`, `failed`, `cancelled` |
| `result` | string or null | One line, written when it finishes |
| `created_at`, `finished_at` | timestamp | |

### Note

| Field | Type |
| --- | --- |
| `id`, `project_id` | id |
| `text` | text |
| `kind` | enum: `note`, `working_agreement` |
| `source_dm_message_id` | id |
| `saved_at` | timestamp |

## Dispatch: write order and failure

Dispatch touches several ledgers. It MUST NOT leave them disagreeing.

1. Mark the room `dispatch_started` in the event log with the full list of intended writes.
2. For each accepted decision, write it to each affected ledger. Writes are idempotent on decision id: writing the same decision twice is a no-op.
3. If every write succeeds: set the room to `closed`, add the system rows, log `dispatched`.
4. If any write fails: the room stays `ratifying`. The ratify sheet shows `Could not write to {handle} ledger.` with "Retry dispatch". Retry repeats step 2 in full, which is safe because writes are idempotent.
5. After the room is closed: wake each affected lead for handoffs, then trigger brief refreshes.

- `R-DATA-06` On launch, any room with `dispatch_started` and no `dispatched` event is detected and shown in `ratifying` with the retry notice.
- `R-DATA-07` A ledger MUST accept a decision write that lists other affected projects it knows nothing about. The `affected` list is stored as handles for this reason.

## Ledger adapter

All ledger access goes through one interface.

| Operation | Notes |
| --- | --- |
| `readBrief(project)` | Latest version |
| `writeBrief(project, body)` | Enforces the size cap |
| `listInterests(project, status)` | |
| `upsertInterest(project, interest)` | |
| `writeDecision(project, decision)` | Idempotent on id |
| `listDecisions(project, limit)` | Newest first |
| `writeHandoff(project, handoff)` / `updateHandoff(id, status, result)` | |
| `writeNote(project, note)` | |

v0 implements this over Continuity.

## Mapping to existing names

Fill this in during the first build task. Leave a row blank only if nothing equivalent exists.

| This spec | Conduit or Continuity equivalent | Notes |
| --- | --- | --- |
| Project | Conduit `Project` (`src-tauri/src/store.rs:393`), persisted in `~/Library/Application Support/ConduitTauri/state.json` under `projects` | Fields used: `id`, `name` (display name), `path` (repo path), `color`. Read only. Order is array order. |
| Product | None. Rooms only (`specs/conflicts.md` C44). | A row of `projects` with `kind = 'product'`. The repos under it carry its id in `product_id`. Has a brief and a persona in the ledger like a project. |
| Lead | None | Not a Conductor. A Conductor (`Session.role = Conductor`, `src-tauri/src/fleet.rs`) is a long-lived terminal session. A lead is a fresh Agent SDK `query()` per wake. The nearest existing pattern is Conduit's root chat (`src-tauri/src/root_chat.rs`). See `conflicts.md` C9, C10. |
| Crew | Conduit worker sessions started by `fleet_spawn` (`src-tauri/src/fleet_mcp.rs:389`), each in `<repo>/.claude/worktrees/<slug>` | Candidate for M5. Only a Conductor can call it today. |
| Ledger | None that fits. Rooms' own SQLite store. | `continuity-mcp` has decisions and handoffs only. See `conflicts.md` C5. |
| Brief | None | Rooms ledger. |
| Interest | None | Rooms ledger. |
| Decision | `continuity-mcp` `decisions` (`packages/shared/src/schema.sqlite.ts:237`): `id`, `decision_key`, `content`, `decision_type`, `project_scope`, `status`, `supersedes` | Mirror target only. `decision_key = {handle}.{dec_id}`, `content` = statement, `project_scope` = handle. Continuity's own `id` is a server UUID and is not ours. |
| Handoff | `continuity-mcp` `handoffs` (`schema.sqlite.ts:287`): `context`, `state`, `suggested_next_actions`, status `pending`, `accepted`, `completed`, `expired` | Not used in v0. No title, no result, no failed state, needs a live session. |
| Note | None | Rooms ledger. |
| RoomEvent | None | `continuity-mcp` `audit_events` is internal to it. Rooms keeps its own append-only table. |
