# 05. Rooms

A room is a temporary conversation between you and one or more leads that ends in decisions.

## States

```text
              tag, message, flag
                 +--------+
                 |        |
                 v        |
  create --->  OPEN  -----+
                 |  ^
          Close  |  |  Back to discussion
                 v  |
             RATIFYING
                 |
        Dispatch | or Close with no decisions (from OPEN)
                 v
              CLOSED   (terminal, read-only)
```

| State | You can | Leads can |
| --- | --- | --- |
| `open` | Send messages, tag projects, tap or dismiss flags, rename the topic, close | Speak when woken, raise flags |
| `ratifying` | Edit, add, drop and accept decisions, go back to discussion, dispatch | Return verdicts. They cannot speak in the stream. |
| `closed` | Read. Continue in a new room. | Nothing |

## Lifecycle

### 1. Create

- `R-ROOM-01` A room is created with a topic and no participants other than you. No lead is woken.
- `R-ROOM-02` A room has a stable id and a creation time. The topic can be renamed while the room is `open`.

### 2. Tag

- `R-ROOM-03` A project enters a room only when a message from you in that room contains `@handle` for it. This is the only way in.
- `R-ROOM-04` On first tag: the lead's status becomes `joining`, its brief is loaded from the ledger, the system row `{handle} joined` is added, and then the lead answers the message that tagged it.
- `R-ROOM-05` If the brief cannot be loaded, the lead does not join. The system row `{handle} could not join: {reason}` appears with a Retry link. The rest of the message is still routed to other addressed leads.
- `R-ROOM-06` A room holds at most 4 leads in v0. Tagging a fifth shows the inline hint `Rooms are limited to 4 projects.` and the mention is treated as plain text.
- `R-ROOM-07` A lead that has joined stays until the room closes.
- `R-ROOM-08` `@all` addresses every lead present. It never brings in a new one.

### 3. Discuss

- `R-ROOM-09` Every message is routed by the rules in `07-speaking-policy.md`.
- `R-ROOM-10` Lead turns are sequential. Only one lead streams at a time in a room, so each lead sees what the previous one said.
- `R-ROOM-11` In a room, leads have read access to their own repo and their own ledger only. They cannot read another project's repo or ledger. They learn about other projects only from what is said in the room.
- `R-ROOM-12` A lead in a room cannot write files, run mutating commands, write to any ledger, or start crew (invariant I8).
- `R-ROOM-13` You MAY edit your most recent message only while no lead has replied to it. You cannot delete messages. Lead messages cannot be edited.

### 4. Close

- `R-ROOM-14` Pressing Close moves the room to `ratifying` immediately. There is no confirmation dialog.
- `R-ROOM-15` Any lead turn in progress is stopped and its partial text kept with the "(stopped)" marker.
- `R-ROOM-16` The clerk drafts decisions from the transcript. See `09-negotiation.md`.
- `R-ROOM-17` If the clerk drafts zero decisions, the ratify sheet shows `No decisions found in this conversation.` with three actions: "Add decision", "Back to discussion", and "Close with no decisions".
- `R-ROOM-18` A room with no lead present skips ratification entirely. Close asks `Close this room?` with "Close" and "Cancel", and goes straight to `closed`.

### 5. Ratify

Defined in `09-negotiation.md`. From the room's point of view:

- `R-ROOM-19` "Back to discussion" returns the room to `open`. Drafted decisions and verdicts are discarded. Open flags are restored as they were.
- `R-ROOM-20` Ratifying cannot be abandoned by navigating away. The room stays `ratifying`, sorted first in the sidebar, until you dispatch or go back.

### 6. Dispatch

- `R-ROOM-21` Dispatch writes every accepted decision to every affected ledger, then asks each affected lead to write its handoffs. Order and failure handling are in `10-data-model.md`.
- `R-ROOM-22` When all decision writes succeed, the room becomes `closed`, the closed time is recorded, and a `Decided: {statement}` system row is added per decision, followed by `Room closed`.
- `R-ROOM-23` Handoff generation happens after the room is closed and does not block it. The closed summary shows each handoff as it arrives.

### 7. Closed

- `R-ROOM-24` A closed room is immutable (invariant I9). Its transcript, decisions, verdicts and handoff links can be read forever.
- `R-ROOM-25` Each lead, on its next wake anywhere, sees the dispatched decisions through its ledger and updated brief. It does not see the closed room's transcript.

## One-lead rooms

- `R-ROOM-26` A room with exactly one lead is valid. Use it for a briefing or a brainstorm that should end in a recorded decision.
- `R-ROOM-27` In a one-lead room the gate is never consulted. Every message from you is answered by that lead, tagged or not, exactly as in a direct chat. The "No project was tagged" hint is never shown.
- `R-ROOM-28` Ratification in a one-lead room works the same way, with one verdict per decision.

## Concurrency

- `R-ROOM-29` A project MAY be in several open rooms at once and in its direct chat. Each wake is independent.
- `R-ROOM-30` Two rooms can therefore dispatch conflicting decisions for the same project. The ledger keeps both in write order. On dispatch, if a decision affects a project that received another decision in the last 24 hours from a different room, the ratify sheet shows a notice on that card: `{handle} has a recent decision from "{other topic}".` with a link. It is a notice, never a block.

## Limits (targets)

| Limit | Value |
| --- | --- |
| Leads per room | 4 |
| Topic length | 3 to 120 characters |
| Message length from you | 16,000 characters |
| Lead reply length, default | About 150 words unless you ask for more |
| Messages a lead receives verbatim | The most recent 200. Older ones are replaced by a clerk-written summary. |
| Decisions per room | 20 |
