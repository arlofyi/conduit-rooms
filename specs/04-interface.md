# 04. Interface

Read `03-design-source.md` first. This file defines structure, behavior, states and copy. Every visual property comes from `~/ooozzy/conduit`.

## Mental model for a builder with no context

Slack is a desktop team chat app. Its window is three vertical columns:

1. A narrow left sidebar listing every conversation. Clicking one opens it in the middle.
2. A wide middle column showing one conversation as a vertical stream of messages, oldest at the top and newest at the bottom, with a text box (the composer) pinned to the bottom edge.
3. An optional right panel with details about the current conversation.

Each message is a row: a small avatar on the left, then the author's name in bold, a small muted timestamp, and the text below. Typing `@` in the composer opens a popup list of people. Picking one inserts a mention, shown as a highlighted pill.

Conduit Rooms borrows exactly that layout and the mention mechanic. The differences: the "people" are projects, each answered by its AI lead, and a mention wakes that lead instead of notifying a human.

## Layout

```text
+------------------+------------------------------------------+----------------------+
| SIDEBAR          | HEADER                                   | PARTICIPANTS RAIL    |
|                  | Plugin interface for mail      [ Close ] |                      |
| Projects         +------------------------------------------+ (U) You              |
|   Hobbyist       |                                          |                      |
|   Conduit        |  -- hobbyist joined --                   | (H) Hobbyist         |
|   Arlo           |                                          |     listening        |
| Direct           | (U) You                         03:12    |                      |
|   hobbyist       |     @hobbyist can plugins ship their     | (C) Conduit       *  |
|   conduit        |     own UI panels?                       |     flagged          |
|   arlo           |                                          |     "This changes my |
| Rooms            | (H) Hobbyist                    03:12    |      session API"    |
| > Plugin interf. |     Yes, with one constraint...          |                      |
|   Auth handoff   |                                          |                      |
| [ + New room ]   +------------------------------------------+                      |
|                  | Message the room. @ to tag a project [->]|                      |
+------------------+------------------------------------------+----------------------+
```

| Region | Fallback width | Behavior |
| --- | --- | --- |
| Sidebar | 240px | Fixed. Use Conduit's sidebar width and collapse behavior if it has them. |
| Centre | Fluid, minimum 480px | Holds header, stream, composer. |
| Participants rail | 280px | Rooms only. Hidden in direct chats. Collapses to avatars only when the window is under 1100px wide. |

Minimum window width: 960px.

## Sidebar

Three sections, in this order, each with a small section heading styled as Conduit styles its sidebar headings.

### Projects

- `R-UI-01` Lists every project, by display name, in the order Conduit lists them.
- `R-UI-02` Clicking a project opens that project's direct chat. (If Rooms ships inside Conduit, clicking opens the project as Conduit does today, and the Direct section is the way into chats. See `12-open-questions.md`.)

### Direct

- `R-UI-03` One row per project, labeled with the project handle in lowercase (`hobbyist`, `conduit`, `arlo`).
- `R-UI-04` Ordered by most recent message, newest first. Projects never messaged sit at the bottom in alphabetical order.
- `R-UI-05` The row for a lead that is currently speaking in that chat shows Conduit's activity indicator.

### Rooms

- `R-UI-06` One row per room, labeled with the room topic, truncated to one line with an ellipsis.
- `R-UI-07` Order: rooms in `ratifying` first, then `open` by most recent activity, then `closed` by closed time, newest first.
- `R-UI-08` Closed rooms use the muted text level. Only the 10 most recent closed rooms show. A "Show all" row at the end expands the rest.
- `R-UI-09` A room with at least one open flag shows a small dot in the warning color at the right edge of its row.
- `R-UI-10` A "New room" button sits below the list.

### Selection

- `R-UI-11` Exactly one sidebar row is selected at a time and uses Conduit's selected row style.
- `R-UI-12` The last opened conversation is restored on launch.

## New room

- `R-UI-13` "New room" opens a small inline form in the centre column: one text field labeled "Topic", placeholder "What is this room about?", and a "Create" button. Enter submits. Escape cancels.
- `R-UI-14` Topic is required, 3 to 120 characters, trimmed.
- `R-UI-15` On create, the room opens empty with the composer focused.
- `R-UI-16` If the topic contains `@handle` mentions of known projects, those projects are tagged in immediately, as if mentioned in a first message. The mentions are removed from the stored topic.

## Header

| Context | Left | Right |
| --- | --- | --- |
| Room, open | Topic. Click to rename inline. | "Close" button. |
| Room, ratifying | Topic, plus a "Ratifying" status badge. | "Back to discussion" button. |
| Room, closed | Topic, plus a "Closed" badge and the closed date. | "Continue in new room" button. |
| Direct chat | Project display name, plus the lead's status word. | "Brief" button that opens the brief sheet. |

## Message stream

### Message row

- `R-UI-17` Layout: avatar, then on one line the author name in the strong text weight and a timestamp in muted small text, then the body below.
- `R-UI-18` You and leads use the same row layout, left aligned. No chat bubbles. No right-aligned messages.
- `R-UI-19` Author name for you is "You". Author name for a lead is the project display name ("Hobbyist"), never "Hobbyist lead" and never a persona name.
- `R-UI-20` Avatar for a lead is the project's icon if Conduit has one, otherwise the first letter of the display name on a tinted background. Avatar for you is your Conduit user avatar or "U".
- `R-UI-21` Consecutive messages from the same author within 5 minutes collapse into a group: one avatar and name, bodies stacked.
- `R-UI-22` Timestamps show local time as `HH:mm`. Hovering shows the full date and time. A date divider row appears when the day changes.

### Body rendering

- `R-UI-23` Bodies render a Markdown subset: paragraphs, bold, italic, inline code, fenced code blocks with a copy button, bulleted and numbered lists, links, blockquotes. No headings, no tables, no images in v0.
- `R-UI-24` `@handle` for a known project renders as a mention pill showing `@handle`. Unknown handles render as plain text.
- `R-UI-25` A body longer than 20 rendered lines is clipped with a "Show more" control. Expanding is remembered for the session.
- `R-UI-26` File paths that exist in the lead's repo render in inline code style. They are not links in v0.

### Streaming

- `R-UI-27` A lead's reply appears as soon as its first token arrives and grows in place.
- `R-UI-28` While a lead is streaming, a "Stop" control appears at the end of its message. Stopping keeps the partial text and appends a muted "(stopped)" marker.
- `R-UI-29` Auto-scroll: if the stream was scrolled to the bottom when new content arrived, stay pinned to the bottom. If you had scrolled up, do not move, and show a "Jump to latest" pill above the composer.

### System rows

Centred, muted, small, no avatar. Used only for the events below. Copy is exact.

| Event | Copy |
| --- | --- |
| Lead joins a room | `{handle} joined` |
| Lead fails to join | `{handle} could not join: {reason}` with a "Retry" link |
| No one was addressed | `No project was tagged. Use @ to address one.` (shown at most once per room) |
| Exchange cap reached | `{handle} and {handle} paused. Over to you.` |
| Room moved to ratifying | `Closing: {n} decisions drafted` |
| Returned to discussion | `Back to discussion` |
| Decision dispatched | `Decided: {statement}` |
| Room closed | `Room closed` |
| Room closed without decisions | `Room closed with no decisions` |
| Ledger note saved from a direct chat | `Saved to {handle} ledger` |
| Handoff sent from a direct chat | `Handed off to {handle} crew: {title}` |

### Error rows

- `R-UI-30` A failed lead reply shows an inline error row under the triggering message: "{Display name} could not reply." with "Retry". Styled with Conduit's danger color at low emphasis.
- `R-UI-31` A failed send of your own message keeps the text in the composer and shows Conduit's inline error style beneath it.

### Empty states

| Context | Copy |
| --- | --- |
| Room with no messages | `Tag a project with @ to bring it in.` |
| Direct chat with no messages | `This is your direct line to {Display name}. Ask it anything about the project.` |
| No rooms yet | `No rooms yet. Start one to get two projects talking.` |
| No projects | `No projects found. Add a project in Conduit first.` |

## Composer

- `R-UI-32` One multi-line text input pinned to the bottom of the centre column. Grows from 1 to 8 lines, then scrolls internally.
- `R-UI-33` Placeholder in a room: `Message the room. @ to tag a project`. In a direct chat: `Message {handle}`.
- `R-UI-34` Enter sends. Shift+Enter inserts a newline. An empty or whitespace-only message cannot be sent.
- `R-UI-35` A send button sits at the right edge, disabled when the input is empty.
- `R-UI-36` You MAY send while a lead is streaming. The new message is queued in the stream and routed when the current lead turn ends.
- `R-UI-37` Draft text is kept per conversation and survives switching conversations and relaunch.

### Mention picker

- `R-UI-38` Typing `@` at the start of the input or after whitespace opens the picker, anchored above the caret, built from Conduit's popover or command menu.
- `R-UI-39` The picker lists projects by handle with display name beside it. Order: projects already in the room first, then the rest, each group alphabetical.
- `R-UI-40` Typing filters by prefix on handle, then by substring on display name. Up and Down move the highlight. Enter or Tab inserts. Escape closes and leaves the typed text.
- `R-UI-41` In a room, the first entry is `@all`, labeled "Everyone in this room". It is hidden when no leads are present.
- `R-UI-42` In a direct chat the picker still opens. Picking a different project inserts the mention and shows a hint row above the composer: `{handle} is not in this chat.` with a button "Start a room with {current} and {handle}". The button creates a room, uses the draft as its first message, and tags both.

## Participants rail (rooms only)

- `R-UI-43` First row is always "You". Then one row per lead present, in join order.
- `R-UI-44` A lead row shows avatar, display name, and exactly one status word beneath the name.

| Status | Meaning | Shown as |
| --- | --- | --- |
| `joining` | Brief is loading | "joining" with Conduit's spinner |
| `listening` | Present and idle | "listening" in muted text |
| `flagged` | Has an open flag | "flagged" plus a warning-color dot on the avatar and the flag line beneath |
| `speaking` | Currently streaming a reply | "speaking" with Conduit's activity indicator |
| `deciding` | Producing verdicts during ratification | "deciding" with Conduit's spinner |
| `error` | Last wake failed | "unavailable" in the danger color with a "Retry" link |

- `R-UI-45` The flag line is one sentence, at most 120 characters, shown in quotes, wrapping to at most 3 lines.
- `R-UI-46` Clicking anywhere on a flagged row lets that lead speak (see `07-speaking-policy.md`) and clears the flag.
- `R-UI-47` A small dismiss control on the flag clears it without waking the lead. It has the tooltip "Dismiss".
- `R-UI-48` Clicking a lead's name or avatar when it is not flagged opens the brief sheet.
- `R-UI-49` Leads cannot be removed from a room in v0.

## Brief sheet

Opened from the rail or the direct chat header. Uses Conduit's side sheet or drawer.

- `R-UI-50` Shows, read-only: project display name and handle, the brief (rendered Markdown), the interests as a list with type and hardness chips, and the five most recent decisions with links to their source rooms.
- `R-UI-51` Has one action: "Edit interests", which opens the interests editor described in `09-negotiation.md`.
- `R-UI-52` Escape or clicking outside closes it.

## Ratify sheet

Shown when a room is `ratifying`. It replaces the composer and rises over the lower part of the centre column, to at most 70% of its height. The stream above stays scrollable. Behavior is in `09-negotiation.md`. Structure:

```text
+--------------------------------------------------------------+
| Decisions (3)                             [ Add decision ]   |
+--------------------------------------------------------------+
| 1. Plugins may ship UI panels through the panel API only.    |
|    Affects: hobbyist, conduit                                |
|    hobbyist [approve]   conduit [object]                     |
|      conduit objects: breaks "session API stable until v1"   |
|      Counter: panels register through sessions, not globally |
|    [ Accept as written ] [ Accept counter ] [ Edit ] [ Drop ]|
+--------------------------------------------------------------+
| 2. ...                                                       |
+--------------------------------------------------------------+
| Unheard flags (1): conduit "This changes my session API"     |
+--------------------------------------------------------------+
|                    [ Back to discussion ]  [ Dispatch (2) ]  |
+--------------------------------------------------------------+
```

- `R-UI-53` Each decision card shows: number, statement, affected project handles as pills, one verdict chip per affected lead, and its action row.
- `R-UI-54` Verdict chips: "approve" in the success color, "object" in the warning color, "escalate" in the danger color, and a spinner while pending.
- `R-UI-55` An object or escalate chip expands inline to show the cited interest statement and the counter-proposal or reason.
- `R-UI-56` "Dispatch (n)" shows the count of accepted decisions and is disabled until every decision is either accepted or dropped.
- `R-UI-57` When every verdict on every decision is approve, an "Accept all" button appears beside Dispatch.

## Closed room

- `R-UI-58` The composer is replaced by a banner: `This room is closed.` with the button "Continue in new room".
- `R-UI-59` Above the banner, a summary block lists each dispatched decision and, under it, each handoff with its project handle and status.
- `R-UI-60` "Continue in new room" creates a room with the topic `{old topic} (continued)`, tags the same projects, and stores a link back to the closed room, shown as the first system row: `Continued from {old topic}`.

## Keyboard

Use Conduit's existing shortcuts where they exist. Otherwise:

| Keys | Action |
| --- | --- |
| Cmd+K | Quick switcher over rooms and direct chats |
| Cmd+N | New room |
| Cmd+Shift+C | Close the current room (asks for nothing, opens ratify) |
| Escape | Close the topmost sheet, picker or popover |
| Cmd+Up / Cmd+Down | Previous or next conversation in the sidebar |
| Up, in an empty composer | Edit your last message, only if no lead has replied to it yet |

## Accessibility

- `R-UI-61` Every interactive element is reachable by keyboard and has a visible focus state from Conduit.
- `R-UI-62` The message stream is a live region that announces new messages politely. Streaming text is announced once, when the message completes.
- `R-UI-63` Status is never conveyed by color alone. The status word is always present as text.
- `R-UI-64` All text meets the contrast Conduit's tokens already provide. Do not lower emphasis below Conduit's muted text level.

## Never on screen

Token counts, cost, model names, tool call logs, raw prompts, gate verdicts, crew output. These MAY appear in a debug panel hidden behind a developer setting.
