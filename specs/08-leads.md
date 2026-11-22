# 08. Leads

## A lead is a role, not a process

A lead does not run continuously and does not remember. Every time a lead is needed, a fresh model session is started, given the brief and the relevant conversation, produces one output, and ends.

Why: a long-running session accumulates context until it is compacted, and compaction silently loses detail. A lead that "holds the context" in a live session is confidently wrong within weeks. Identity therefore lives in the ledger, which is explicit, inspectable and editable.

- `R-LEAD-01` No lead state survives between wakes except what is in the ledger.
- `R-LEAD-02` Two wakes of the same lead MAY run at the same time (for example one room and the direct chat). They do not share anything.

## Wake reasons

Every wake has exactly one reason. The reason is stated at the top of the prompt.

| Reason | Where | The lead must |
| --- | --- | --- |
| `addressed` | Room | Answer the message that tagged it |
| `flag_tapped` | Room | Explain the flag it raised |
| `gate_speak` | Room | Make the one point the gate identified |
| `addressed_by_lead` | Room | Answer the other lead's question |
| `ratify` | Room | Return a verdict for each decision that affects it |
| `handoff` | After dispatch, or direct chat | Write the work order for its crew |
| `direct` | Direct chat | Answer your message |
| `refresh_brief` | Background | Rewrite its brief from the ledger and repo |

## The brief

The brief is a Markdown document in the ledger. It is the lead's entire starting knowledge about its own project.

### Format

```markdown
# {Display name} ({handle})

## Purpose
Three lines at most. What this project is and who it is for.

## State
What exists today, what is in progress, what the crew is doing right now.

## Owned surface
- Paths: ...
- Services: ...
- Interfaces: ...
- Keywords: up to 40 terms, comma separated

## Interests
- [int_...] (contract, hard) Statement.
- [int_...] (deadline, soft) Statement.

## Open decisions
Decisions in progress or awaiting follow-up, one line each.

## Recent decisions
The last five dispatched decisions: date, id, statement.

## Working agreements
Standing instructions from you, saved from direct chats.
```

- `R-LEAD-03` Target size: 2,000 tokens. Hard cap: 4,000. A brief over the cap is rejected on write and the lead is asked to shorten it.
- `R-LEAD-04` The Interests section is generated from the interest records, never hand-edited in the brief.
- `R-LEAD-05` The Owned surface section is the source for the router's ownership match (`R-SP-04`).
- `R-LEAD-06` You can read the brief at any time from the brief sheet. You can edit it directly in the ledger.

### Refresh

- `R-LEAD-07` The brief is rewritten by a `refresh_brief` wake after: a room that affected the project is dispatched, a handoff finishes, a note or decision is saved from the direct chat, or an interest changes.
- `R-LEAD-08` Refresh is debounced: at most one per project per 5 minutes, and never while another refresh for that project is running.
- `R-LEAD-09` A refresh that fails leaves the previous brief in place and logs an event. It never blocks a conversation.
- `R-LEAD-10` Every version of the brief is kept in the ledger so a bad refresh can be undone.

### First brief

- `R-LEAD-11` A project with no brief gets one the first time it is tagged or messaged: a `refresh_brief` wake reads the repo (README, top-level structure, recent commits, any existing agent memory files) and drafts it. The lead's status is `joining` while this runs.
- `R-LEAD-12` The first brief has an empty Interests section. Interests are proposed and approved separately (see `09-negotiation.md`). A lead with no approved interests can still talk, but it cannot object or escalate.

## Prompt assembly

For any wake, the prompt is assembled in this order:

1. Role: you are the lead for {Display name}. You represent this project and only this project.
2. Wake reason and what is expected.
3. The speaking rules from `07-speaking-policy.md` (rooms) or the direct chat rules.
4. The brief.
5. Capabilities and limits for this wake.
6. The conversation: room transcript (most recent 200 messages verbatim, earlier ones summarized) or the last 40 direct chat messages.
7. For `flag_tapped`: the flag line. For `gate_speak`: the gate line. For `ratify`: the drafted decisions and any unheard flags.

- `R-LEAD-13` Other projects' briefs, interests and ledgers are never included. A lead knows about another project only what was said in the conversation.
- `R-LEAD-14` In a room transcript, each message is labeled with its author: "You" for the human, the handle for a lead.

## Capabilities

| Capability | Room | Direct chat | Handoff or refresh |
| --- | --- | --- | --- |
| Read own repo (files, git log, search) | Yes | Yes | Yes |
| Read own ledger | Yes | Yes | Yes |
| Read another project's repo or ledger | No | No | No |
| Write files, run mutating commands | No | No | Crew only |
| Write to own ledger | No | Only through a card you confirm | Yes: handoffs and brief |
| Start or instruct crew | No | Only through a handoff you confirm | Yes |
| Browse the web | No in v0 | No in v0 | Follows Conduit's existing crew policy |

- `R-LEAD-15` These limits MUST be enforced by the tools the lead session is given, not by instructions in the prompt alone.
- `R-LEAD-16` Tool use during a conversation wake is capped at 8 read calls and 30 seconds before the first token. If the lead needs more it says what it would need to look into and stops.

## Voice

- `R-LEAD-17` Leads speak plainly, in first person singular, as the project: "I can expose that through the panel API."
- `R-LEAD-18` No personas, names, catchphrases or emoji in v0.
- `R-LEAD-19` A lead does not claim certainty it lacks. If the answer depends on something it did not check, it says so in one clause.

## Crew

- `R-LEAD-20` Crew are started by the lead through Conduit's existing mechanism for parallel worktree sessions. This spec does not redefine it.
- `R-LEAD-21` Crew receive the handoff work order and the brief. They do not receive any room or direct chat transcript.
- `R-LEAD-22` Crew results are written to the ledger against the handoff. The lead reads them at its next wake through the refreshed brief.
- `R-LEAD-23` On a project with no crew configured, the lead executes the handoff itself in a `handoff` wake with write capability, scoped to a worktree.

## Runtime adapter

The lead runtime sits behind one interface so the harness can change without touching the product.

| Operation | Purpose |
| --- | --- |
| `wake(project, reason, context, tools) -> stream` | Start a lead session and stream its output |
| `stop(wakeId)` | Stop a streaming session |
| `classify(input) -> verdict` | Run the gate |
| `draft(transcript) -> decisions` | Run the clerk |

v0 implements this over Conduit Code. The gate implements `classify` over a local model.
