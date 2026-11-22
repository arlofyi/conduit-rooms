# 12. Open questions

Each question lists the default this spec assumed. The spec is consistent with the defaults. Changing one may require edits in the files named.

| # | Question | Default assumed | Touches |
| --- | --- | --- | --- |
| Q1 | Is Conduit Rooms its own app, or a mode inside Conduit? | Its own repo and app that reuses Conduit's design and reads Conduit's projects. The spec works either way. | 01, 03, 04 (`R-UI-02`) |
| Q2 | Does it use the same stack as Conduit? | Yes, identical, unless Uzair says otherwise. | 03 |
| Q3 | Which local model runs the gate? | Undecided. Any local model that returns strict JSON in under 1 second on Uzair's machine. | 07 |
| Q4 | Which model runs leads and the clerk? | Whatever Conduit Code is configured to use. | 08 |
| Q5 | Can a lead be in several rooms at once? | Yes. Conflicts are surfaced by a notice, not prevented. | 05 (`R-ROOM-29`, `R-ROOM-30`) |
| Q6 | Can a lead write to its repo during a conversation? | No. Read-only in rooms and direct chats. Work happens through handoffs. | 08 |
| Q7 | Who writes the first interests? | The lead proposes them in the direct chat. You approve each one. | 09 |
| Q8 | Do room handoffs start automatically after dispatch? | Yes. Ratifying is the approval. | 09 (`R-NEG-28`) |
| Q9 | How much of a direct chat does the lead see? | The last 40 messages plus the brief. | 06 (`R-DM-16`) |
| Q10 | Does saving from a direct chat need confirmation every time? | Yes, always. | 06 |
| Q11 | Do leads have personas or names? | No. They speak as the project, plainly. | 04 (`R-UI-19`), 08 |
| Q12 | Maximum leads per room? | 4. The success test uses 2. | 05 |
| Q13 | Does a lead do the work itself on a small project? | Yes, when no crew is configured. | 08 (`R-LEAD-23`) |
| Q14 | Can leads browse the web in conversations? | No in v0. | 08 |
| Q15 | Is the unprompted SPEAK budget of 1 per room right? | Unknown until M3 is in use. | 07 |
| Q16 | Should closed-room transcripts ever feed a lead? | No. Only what was dispatched to the ledger. | 05 (`R-ROOM-25`) |
| Q17 | Do project handles come from Conduit or get set here? | Slug of the Conduit project name, editable here. | 10 |

## Known risks

1. **Agreeable leads.** The whole negotiation model depends on interests being specific enough to be violated. This is a writing problem more than an engineering one. Budget time for it.
2. **Brief quality.** A thin or stale brief makes a lead confidently wrong, which is worse than no lead. Brief refresh is not optional polish.
3. **Gate tuning.** Expect the first gate to be wrong in both directions. The debug panel and event log exist so it can be tuned from real conversations.
4. **Latency stacking.** A two-lead room with a gate call, a join and a reply can feel slow. Sequential turns are a deliberate trade for coherence. Watch the first-token target.
5. **Unverified foundations.** This spec was written without reading Conduit or Continuity. M0 exists to catch what that got wrong before any product code is written.
