# 09. Negotiation

Language models agree with each other by default. Put three in a conversation and you get a politeness spiral. Negotiation works here only because each lead has declared interests to protect and a formal moment at which it must rule on every decision that affects it.

## Interests

### Shape

| Field | Values |
| --- | --- |
| `statement` | One sentence, concrete and checkable. "The plugin interface stays backward compatible through v1." |
| `type` | `contract` (an interface or promise others rely on), `deadline` (a date), `budget` (a limit on cost, size, time or dependencies), `quality` (a bar that must not drop) |
| `hardness` | `hard` or `soft` |
| `status` | `proposed`, `approved`, `retired` |

### Rules

- `R-NEG-01` A project holds three to seven approved interests. The interests editor warns below three and blocks above seven.
- `R-NEG-02` Only approved interests count. A lead can cite only approved interests.
- `R-NEG-03` A lead MAY propose an interest at any time through a card in its direct chat. It becomes approved only when you approve it.
- `R-NEG-04` You MAY add, edit, change the hardness of, or retire any interest from the interests editor in the brief sheet.
- `R-NEG-05` `hard` means only you can concede it. `soft` means the lead may trade it away in exchange for something, and must say that it is doing so.
- `R-NEG-06` Retired interests are kept in the ledger for history and excluded from the brief.

### A good interest

| Good | Bad | Why |
| --- | --- | --- |
| "Session API signatures do not change before v1." | "Keep the API clean." | The bad one cannot be checked against a proposal. |
| "Cold start stays under 2 seconds on an M1." | "Performance matters." | No threshold. |
| "No new runtime dependency over 1 MB." | "Stay lightweight." | Not decidable. |

- `R-NEG-07` When proposing an interest, a lead MUST phrase it so that a specific proposal can be judged as violating it or not.

## Closing a room: the clerk

- `R-NEG-08` On Close, the clerk reads the full transcript and drafts decisions. The clerk is a neutral model call. It belongs to no project and has no brief.
- `R-NEG-09` Each drafted decision has: a statement (one sentence, imperative or declarative, self-contained), the affected projects, a one-line rationale, and the ids of the messages it is based on.
- `R-NEG-10` The clerk drafts only what was actually agreed or what you stated as decided. It MUST NOT invent decisions from ideas that were merely discussed. Unresolved points are listed separately as "Left open" and are not decisions.
- `R-NEG-11` A project is "affected" by a decision if the decision requires that project to do something, changes something in its owned surface, or touches one of its interests. A project that merely took part in the discussion is not affected.
- `R-NEG-12` Before verdicts are requested you can edit any statement, change the affected projects, add a decision, or drop one. Verdicts are requested when you press "Send to leads", or automatically after 3 seconds if you make no edit.

## Verdicts

Each affected lead is woken once with reason `ratify` and returns one verdict per decision that affects it.

| Verdict | Meaning | Must include |
| --- | --- | --- |
| `approve` | No interest is harmed, or a soft interest is traded knowingly. | If a soft interest was traded: which one, and for what. |
| `object` | A soft interest is harmed and the lead does not accept the trade. | The interest id, one sentence on how the decision harms it, and a counter-proposal. |
| `escalate` | A hard interest is harmed. | The interest id and one sentence on how. A counter-proposal is optional. |

- `R-NEG-13` Leads return verdicts independently and in parallel. A lead does not see other leads' verdicts.
- `R-NEG-14` An objection or escalation that cites no approved interest is invalid. It is converted to `approve` with a note, "Objected without citing an interest: {text}", shown muted on the card. This removes vague hedging while still letting you see it.
- `R-NEG-15` A counter-proposal is a full replacement statement for the decision, not a comment on it.
- `R-NEG-16` A lead with no approved interests can only approve (`R-LEAD-12`). The card shows "{handle} has no interests yet" with a link to add some.
- `R-NEG-17` Verdict timeout is 60 seconds per lead. On timeout or failure the chip shows "no verdict" with Retry. A decision with a missing verdict can still be accepted. That counts as an override.

## Resolving

For each decision you choose one action:

| Action | Available when | Result |
| --- | --- | --- |
| Accept as written | Always | Decision is accepted. If any verdict was object, escalate or missing, this is an override. |
| Accept counter | At least one counter-proposal exists | The statement is replaced by the chosen counter. Every other affected lead is asked for a fresh verdict on the new statement. |
| Edit | Always | You rewrite the statement. All affected leads are asked for fresh verdicts. |
| Drop | Always | The decision is removed. It is recorded in the room's event log as dropped, and written to no ledger. |

- `R-NEG-18` Re-ratification after "Accept counter" or "Edit" happens at most twice per decision. After the second round the only actions are "Accept as written" and "Drop". This guarantees the room ends (invariant I10).
- `R-NEG-19` "Back to discussion" is available at any point and discards all drafts and verdicts (`R-ROOM-19`).
- `R-NEG-20` Dispatch is enabled when every decision is accepted or dropped. If every decision is dropped, the button reads "Close with no decisions".

## Overrides

- `R-NEG-21` You can accept any decision regardless of verdicts. Leads advise. You decide (principle P6).
- `R-NEG-22` An override is recorded on the decision: which lead objected or escalated, the cited interest, the lead's reason, and its counter-proposal if any. The dissent survives in every affected ledger.
- `R-NEG-23` Overriding an `escalate` asks for one confirmation, because a hard interest is being conceded: `This overrides a hard interest of {handle}: "{statement}".` with "Override" and "Cancel".
- `R-NEG-24` After an override of a hard interest, the interests editor for that project shows a notice on that interest: `Overridden in "{room topic}" on {date}.` You decide whether to keep, soften or retire it. Nothing changes automatically.

## Handoffs

- `R-NEG-25` After dispatch, each affected lead is woken with reason `handoff` and writes one handoff per decision that requires work from its project. A decision that requires no work from a project produces no handoff for it.
- `R-NEG-26` A handoff has: a title, a work order (what to do, in which part of the repo, and how to tell it is done), a link to the decision, and a status.
- `R-NEG-27` The work order MUST be executable by crew that has seen only the brief and the handoff. It restates what it needs from the decision instead of pointing at the room.
- `R-NEG-28` Handoffs from a room start automatically. They do not wait for your confirmation, because you already ratified the decision. This is the "send them off" moment. (Handoffs from a direct chat do need confirmation, `R-DM-11`.)

## Health signals

The system is working when leads sometimes disagree. Track per project and overall:

| Signal | Reading |
| --- | --- |
| Share of decisions with at least one object or escalate | Near 0% over many rooms means interests are too weak or too vague. |
| Share of objections converted to approve for citing no interest | High means the lead is hedging. Tighten the interests or the prompt. |
| Share of overrides | High means the interests no longer match what you want. Review them. |
| Flags tapped versus dismissed | Mostly dismissed means the gate is too loose. |
