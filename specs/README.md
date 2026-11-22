# Conduit Rooms: Specification

Status: Draft v0.2
Last Updated: 2026-11-21
Owner: Uzair Hayat

## How to read this

Read the files in order. Each one stands alone, but later files use terms defined in earlier ones.

| File | Covers |
| --- | --- |
| [01-product.md](01-product.md) | What this is, who it is for, principles, non-goals |
| [02-concepts.md](02-concepts.md) | Every term, defined once, with its invariants |
| [03-design-source.md](03-design-source.md) | Where the UI comes from (`~/ooozzy/conduit`) and the rules for reusing it |
| [04-interface.md](04-interface.md) | The screen, region by region, with every state and all copy |
| [05-rooms.md](05-rooms.md) | Room lifecycle and state machine |
| [06-direct-chats.md](06-direct-chats.md) | Private one-to-one chats with a lead |
| [07-speaking-policy.md](07-speaking-policy.md) | Who speaks, when, and who decides: router, gate, flags, budgets |
| [08-leads.md](08-leads.md) | Lead identity, the brief, rehydration, permissions, crew |
| [09-negotiation.md](09-negotiation.md) | Interests, verdicts, the ratify algorithm, overrides |
| [10-data-model.md](10-data-model.md) | Entities, fields, constraints, the event log, ledger writes |
| [11-build-plan.md](11-build-plan.md) | Milestones, acceptance criteria, the success test |
| [12-open-questions.md](12-open-questions.md) | Decisions not yet made, each with the default this spec assumed |

## Conventions

- MUST, MUST NOT, SHOULD and MAY carry their usual requirement meanings.
- "You" always means the single human user. There is exactly one human in v0.
- Requirements are numbered per file (for example `R-ROOM-07`) so they can be cited in commits and reviews.
- No em-dashes anywhere in this repo: not in specs, UI copy, code comments or commit messages.
- When a spec and `~/ooozzy/conduit` disagree about how something looks, Conduit wins. When they disagree about how Rooms behaves, the spec wins.

## What was known when this was written

Be skeptical of this spec in three places:

1. The author did not have access to `~/ooozzy/conduit` or the Continuity codebase while writing. No color values, component names, framework choices or storage details from those repos appear here. Wherever this spec needs them it says "take it from Conduit" and the builder MUST go and look.
2. Entity names (Lead, Crew, Ledger, Decision, Handoff) describe roles. Conduit and Continuity may already have names for the same things. Where they do, use the existing names in code and keep this spec's names in a mapping table in `10-data-model.md`.
3. Numbers marked "target" are starting points to be tuned, not measured facts.
