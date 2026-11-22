# 01. Product

## One sentence

Conduit Rooms is a chat workspace where each of your projects is represented by one durable lead agent, and you work with those leads the way a product manager works with colleagues: in private chats, or together in a room.

## The experience

You are the product manager. Each project has a lead who knows that project cold.

- You want a quick answer about Arlo. You open the direct chat with `arlo` and ask.
- You want Hobbyist and Conduit to agree on an interface. You open a room, type `@hobbyist @conduit`, and all three of you talk it through.
- When you are done, you close the room. The decisions are written down, each lead takes its share of the work back to its project, and you move on.

You never manage "agents". You talk to projects. The lead is how a project answers.

## The bet

Agents with standing beat agents summoned per task.

Most agent chat products create an agent for a task and discard both when the task ends. Here the project and its lead persist, and the conversation is the temporary thing. A lead owns its project's context, holds interests it must protect, and can say no. That makes two things possible that task agents cannot do:

1. You can ask a lead about its project without restating context.
2. Two leads can negotiate, because each one has something to defend.

## Principles

| # | Principle | What it rules out |
| --- | --- | --- |
| P1 | You talk to projects, not agents. | Agent pickers, model pickers, persona config in the main flow. |
| P2 | Silence is decided upstream. A lead that is invoked always produces output, so the system decides whether to invoke it. | Asking a lead "do you want to say something?" |
| P3 | The ledger is the memory. If it is not in the ledger, the lead does not know it. | Long-lived agent sessions that "remember". |
| P4 | The transcript is not the output. A room produces decisions and handoffs. | Rooms that end with nothing written down. |
| P5 | A flag is cheaper than a message. | Leads posting "just flagging that..." paragraphs. |
| P6 | You have the final word. Leads advise, object and escalate. They never block you. | Any state where you cannot proceed. |
| P7 | Show the conversation and what needs you. Everything else is behind a tap. | Token counters, tool call logs and crew chatter on the main screen. |
| P8 | One project, one lead, one ledger. | Shared leads, multiple leads per project, cross-project writes from one chat. |

## Who it is for

v0 has one user: a founder or engineer who runs several projects at once with coding agents and wants to direct them at the level of intent, not keystrokes.

## Non-goals for v0

- Multiple human users, sharing, or permissions.
- Channels, threads, emoji reactions, file uploads, global search, unread badges, notifications.
- Leads that start conversations on their own.
- Leads tagging in projects that are not already in the room.
- Rooms that span machines, or any hosted or cloud component.
- Mobile.
- Voice.
- Custom personas, avatars or voices for leads.

## Relationship to the existing stack

| Existing piece | Role in Conduit Rooms |
| --- | --- |
| Conduit (desktop app) | Source of the entire visual design. See `03-design-source.md`. Also the source of the project list. |
| Conductor sessions in Conduit | The closest existing thing to a lead with a crew. A lead SHOULD be built on this if possible. |
| Conduit Code (agent harness) | Runs lead and crew model sessions. |
| Continuity (coordination ledger) | The ledger. Briefs, interests, decisions and handoffs live here. |
| Hobbyist | Not a dependency. It is one of the first two projects used in the success test. |

Whether Conduit Rooms ships as its own app or as a mode inside Conduit is open (see `12-open-questions.md`). This spec is written so that either works.
