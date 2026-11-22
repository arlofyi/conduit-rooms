# 11. Build plan

Build in the order below. Each milestone is usable on its own and has acceptance criteria that can be checked by hand.

## M0. Ground truth (no product code)

Goal: replace this spec's assumptions with facts.

1. Read `~/ooozzy/conduit`. Write `specs/design-tokens.md` as required by `03-design-source.md`: stack, tokens, reusable components with paths, and how the design will be shared.
2. Read the Continuity codebase. Fill in the mapping table at the end of `10-data-model.md`.
3. Decide, with Uzair, whether this ships as its own app or as a mode inside Conduit (`12-open-questions.md`, Q1).
4. List every place this spec conflicts with what exists, in `specs/conflicts.md`, each with a proposed resolution.

Done when: all four documents exist and Uzair has answered Q1.

## M1. Shell and direct chats

Goal: talk to one project's lead and have it answer from its brief.

Scope: app shell from Conduit, sidebar with Projects and Direct, direct chat stream and composer, lead wake with reason `direct`, first-brief generation, brief sheet (read-only), message persistence, drafts.

Acceptance:

- [ ] The window is visually indistinguishable in style from Conduit: same colors, type, spacing, components.
- [ ] Every project in Conduit appears under Direct by handle.
- [ ] Sending a message to a project with no brief generates a brief, then answers.
- [ ] The answer reflects the actual repo (ask "what is the entry point?" and check it).
- [ ] The lead cannot modify any file during a direct chat. Verified by asking it to and checking the repo is unchanged.
- [ ] Quitting and relaunching restores the conversation, the scroll position and the draft.
- [ ] Stop halts a streaming reply and keeps the partial text.

## M2. Rooms with addressed speech only

Goal: a room with two leads where only tagged leads speak.

Scope: Rooms sidebar section, new room, tagging and joining, mention picker, participants rail with `joining`, `listening`, `speaking`, sequential turns, `@all`, lead-to-lead addressing with the exchange cap, room event log. No gate, no flags, no ratification. Close moves the room straight to `closed`.

Acceptance:

- [ ] Tagging `@hobbyist` in a new room shows `hobbyist joined`, then a reply.
- [ ] A message with no tag wakes no one and shows the untagged hint once.
- [ ] With two leads present, `@hobbyist` alone produces a reply from hobbyist only.
- [ ] `@all` produces one reply from each lead, in join order, each aware of the previous.
- [ ] A lead that mentions the other lead gets an answer, and the exchange stops at the cap with the paused row.
- [ ] A lead cannot read the other project's repo. Verified by asking it for a file that exists only there.
- [ ] Every routing decision appears in the event log with its rule.

## M3. Gate and flags

Goal: untagged leads stay quiet but can raise a hand.

Scope: owned surface and keywords in the brief, ownership match, local gate, flags in the rail, tap and dismiss, silence budget, the debug panel for routing decisions.

Acceptance:

- [ ] A message that names a file owned by an untagged lead produces a flag on that lead, not a message.
- [ ] Tapping the flag produces a reply about that specific concern and clears the flag.
- [ ] Dismissing clears it and wakes no one.
- [ ] A message unrelated to an untagged lead produces no gate call (visible in the debug panel).
- [ ] With the gate process killed, relevant messages still produce the fallback flag within 2 seconds.
- [ ] Across a 30-message test conversation, no lead speaks unprompted more than once.
- [ ] Gate p95 latency is under 1 second on Uzair's machine.

## M4. Interests, ratification, dispatch

Goal: a room ends in decisions written to both ledgers.

Scope: interests (propose in direct chat, approve, edit, retire), clerk, ratify sheet, verdicts, counter-proposals, re-ratification rounds, overrides, dispatch with idempotent writes and retry, closed room summary, brief refresh after dispatch.

Acceptance:

- [ ] Each test project has three to seven approved interests.
- [ ] Closing a room drafts decisions that match what was actually agreed, and lists unresolved points as left open.
- [ ] A decision that violates a soft interest produces an `object` citing that interest with a counter-proposal.
- [ ] A decision that violates a hard interest produces an `escalate`, and accepting it asks for the override confirmation.
- [ ] An objection that cites no interest is shown as a converted approve with its note.
- [ ] "Accept counter" triggers fresh verdicts from the other leads, at most twice.
- [ ] After dispatch, the decision exists with the same id and statement in both ledgers.
- [ ] Forcing one ledger write to fail leaves the room in ratifying with a working "Retry dispatch", and no duplicate decisions after retry.
- [ ] After dispatch, each lead's brief lists the new decision under Recent decisions.

## M5. Handoffs and saving from direct chats

Goal: leads go off and do the work.

Scope: `handoff` wakes after dispatch, handoff records and status, closed summary shows handoffs, note and handoff cards in direct chats, working agreements in the brief.

Acceptance:

- [ ] After dispatch, each affected project has a handoff whose work order can be executed by crew that never saw the room.
- [ ] Crew starts without any further input from Uzair.
- [ ] Handoff status updates appear in the closed room summary.
- [ ] In a direct chat, "Save to ledger" writes a note only after confirmation, and the next wake of that lead reflects it.
- [ ] A direct chat handoff does nothing until "Send to crew" is pressed.

## The success test

Run this after M5. It is the test of whether the product works, not whether the code works.

Setup: `hobbyist` and `conduit`, each with a brief and three to seven approved interests. Pick one real, currently undecided interface question between the two projects.

Procedure: open a room, tag both, discuss until you would normally stop, close, ratify, dispatch.

It passes when all of these are true:

1. At least one lead objected or escalated, citing a real interest.
2. The decision landed in both ledgers.
3. Each crew executed its handoff without you restating any context.
4. You sent fewer than 10 messages.
5. You would have reached a worse decision, or the same one more slowly, by driving two separate agent sessions by hand.

## Fail signals

| Signal | Likely cause | First thing to try |
| --- | --- | --- |
| Both leads approve everything on the first pass, three rooms in a row | Interests too vague, or leads too agreeable | Rewrite interests to be checkable (`R-NEG-07`) |
| You tap almost no flags | Gate too loose, flags are noise | Tighten the FLAG guidance, shrink keyword lists |
| Leads miss things you expected them to catch | Owned surface or keywords incomplete, or gate too strict | Inspect `route_decision` events for `no_match` |
| Crew asks what the handoff means | Work orders lean on the room | Enforce `R-NEG-27` in the handoff prompt |
| A lead states something stale about its project | Brief refresh not firing or brief too thin | Check `brief_refreshed` events |
| You keep re-explaining the same preference in direct chats | Working agreements not being saved | Make the lead propose saving sooner (`R-DM-18`) |

## Performance targets

| Measure | Target |
| --- | --- |
| Router rule decision | Under 50 ms |
| Gate, p95 | Under 1 s |
| Brief load on join | Under 2 s when a brief exists |
| First token from an addressed lead | Under 3 s after join |
| Clerk draft on Close | Under 15 s |
| All verdicts for a two-lead room | Under 30 s |
| Stream rendering | No dropped frames while a lead streams |
