# 07. Speaking policy

The hardest problem in this product is one question: when should a lead speak, if it should speak at all?

## The core rule

A lead never decides its own silence. A model that has been invoked always produces output, so by the time a lead is "deciding" whether to speak, the decision has already been lost. Whether a lead is invoked is decided before it runs, by the router, and in ambiguous cases by the gate.

This policy applies to rooms with two or more leads. One-lead rooms and direct chats always answer (see `R-ROOM-27`, `R-DM-03`).

## Outcomes

For each lead present, each new message has exactly one outcome:

| Outcome | Effect |
| --- | --- |
| `SPEAK` | The lead is woken and writes a message in the stream. |
| `FLAG` | The lead is not woken. A one-line flag appears on its row in the rail. |
| `SILENT` | Nothing visible happens. |

## Router

The router is deterministic code. It runs on every new message, whoever wrote it.

### On a message from you

```text
for each lead L present in the room:
    if message mentions L's handle, or mentions @all:
        outcome[L] = SPEAK            (rule: addressed)
    else if no ownership match between message and L's owned surface:
        outcome[L] = SILENT           (rule: not relevant, gate not called)
    else:
        outcome[L] = gate(L, message) (may return SPEAK, FLAG or SILENT)
        if outcome[L] == SPEAK and L has no unprompted budget left:
            outcome[L] = FLAG

speak order = addressed leads in the order they were mentioned,
              then gate-approved leads in join order
```

- `R-SP-01` Mentions of projects not yet in the room are processed first (they join, per `R-ROOM-04`), then routing runs with them present.
- `R-SP-02` If no lead ends up with `SPEAK` and none with `FLAG`, and the message contained no mention, show the system row `No project was tagged. Use @ to address one.` once per room.
- `R-SP-03` Leads speak one at a time in speak order. Each sees the replies before it.

### Ownership match

Deterministic, no model. A message matches lead L when any of these is true:

1. It contains a file path or path prefix listed in L's owned surface.
2. It contains, as a whole word and ignoring case, a service name, interface name or keyword listed in L's owned surface.
3. It contains L's project display name or handle as a plain word without `@`.
4. It is a reply within 2 messages of a message L wrote and contains a second-person address ("you", "your") with no mention of another lead.

- `R-SP-04` The owned surface lives in the brief (see `08-leads.md`) and includes an explicit keyword list of at most 40 terms so this match stays cheap and predictable.
- `R-SP-05` The match is deliberately loose. It only decides whether the gate is worth calling.

### On a message from a lead

```text
if the message mentions another present lead M:
    if the exchange cap is not reached:
        M speaks next                 (rule: addressed by a lead)
    else:
        show system row "{L} and {M} paused. Over to you."
else:
    for each other lead M with an ownership match:
        outcome = gate(M, message)
        SPEAK is downgraded to FLAG   (a lead message never triggers an unprompted SPEAK)
```

- `R-SP-06` A lead cannot mention a project that is not in the room. Such a mention renders as plain text and wakes no one.
- `R-SP-07` A lead cannot use `@all`.

## Gate

The gate is a small model, run locally, with one job: classify.

### Contract

Input:

| Field | Content |
| --- | --- |
| `topic` | Room topic |
| `recent` | The last 10 messages, each with author and text |
| `message` | The new message |
| `project` | Handle and display name of the lead being considered |
| `owned_surface` | Paths, services, interfaces, keywords |
| `interests` | Id and statement of each interest, with hardness |

Output, strict JSON:

```json
{ "verdict": "SPEAK | FLAG | SILENT", "line": "string, max 120 chars", "interest_id": "string or null" }
```

- `R-SP-08` The gate MUST NOT be given the ability to produce a reply, and the lead MUST NOT be invoked to produce the verdict. Separating "should I" from "what would I say" is the point. A model holding a drafted answer always wants to deliver it.
- `R-SP-09` `line` is written in the lead's first person and names the concern concretely: "This changes my session API." Not "I may have relevant input."
- `R-SP-10` `interest_id` is set when the concern maps to a specific interest. A flag that cites a hard interest is shown first in the rail.

### Verdict guidance given to the gate

| Verdict | Use when |
| --- | --- |
| `SPEAK` | The message states something false about this project that others are about to rely on, or it asks a question only this project can answer and nobody was addressed. |
| `FLAG` | The message affects something this project owns or an interest it holds, and the project was not addressed. This is the default for anything relevant. |
| `SILENT` | The ownership match was incidental and nothing this project owns or protects is affected. |

### Bias

- `R-SP-11` The gate is tuned to be generous with `FLAG` and stingy with `SPEAK`. The costs are asymmetric: a lead that stays silent when it should have objected costs a broken interface. A flag you ignore costs a dot.
- `R-SP-12` Target rates in normal use: fewer than 1 in 20 gate calls return `SPEAK`.

### Failure

- `R-SP-13` Gate timeout is 2 seconds (target p95 under 1 second). On timeout, malformed output or error, the outcome is `FLAG` with the line `Possibly relevant to {handle}.` Failing toward a flag follows from the asymmetry above.
- `R-SP-14` Gate calls for different leads on the same message run in parallel.
- `R-SP-15` The gate runs on a local model so that staying silent costs nothing. Which model is open (see `12-open-questions.md`).

## Flags

- `R-SP-16` A lead has at most one open flag per room. A new flag replaces the old one. The old one is recorded as `superseded`.
- `R-SP-17` Tapping a flag wakes the lead with this instruction: you raised this flag, say what you need to say about it. This counts as addressed, not as unprompted, and does not spend budget.
- `R-SP-18` Dismissing a flag records it as `dismissed`. The lead is not told.
- `R-SP-19` When a lead speaks for any reason, its open flag is cleared and recorded as `spoken`.
- `R-SP-20` Flags still open at Close are listed in the ratify sheet under "Unheard flags". They are a prompt for you, and they are given to the lead as context when it produces verdicts.

## Budgets and caps

| Control | Value | Resets |
| --- | --- | --- |
| Unprompted `SPEAK` per lead | 1 per room | Never. Returning from ratifying does not reset it. |
| Lead-to-lead exchange cap | 3 turns per lead | When you send a message |
| Total lead messages between two of your messages | 6 | When you send a message |
| Open flags per lead | 1 | n/a |

- `R-SP-21` When the exchange cap or the total cap is hit, the current turn finishes, no further lead is woken, and the "paused" system row appears.
- `R-SP-22` Budgets are per room and are not shared across rooms.

## Ratification is separate

- `R-SP-23` During ratification every affected lead is invoked regardless of anything above. This is the safety net that makes quiet leads safe: a lead that never spoke still gets one guaranteed pass at every decision that affects it.

## What a lead is told about speaking

Every lead prompt in a room includes these rules:

1. You were woken for one reason, stated above. Address that and stop.
2. Be brief. Default to under 150 words. No greeting, no restating the question, no closing offer of further help.
3. Do not address another project unless you need something specific from it. If you do, mention it with `@handle` and ask one question.
4. Do not agree for the sake of agreeing. If a proposal harms one of your interests, say which one and offer an alternative.
5. If you have nothing to add, say so in one short sentence.

## Observability

- `R-SP-24` Every router decision is written to the room's event log with: message id, lead, rule or gate verdict, gate line, latency. See `10-data-model.md`.
- `R-SP-25` A hidden debug panel shows these per message. It is the main tool for tuning the gate and MUST exist from the first build that includes the gate.
