# 06. Direct chats

A direct chat is a permanent, private, one-to-one conversation between you and one project's lead. It is the same as messaging a colleague.

## Rules

- `R-DM-01` Every project has exactly one direct chat. It exists as soon as the project exists and it never closes.
- `R-DM-02` It is named by the project handle in the sidebar and by the display name in the header.
- `R-DM-03` Every message you send is answered by the lead. There is no router decision, no gate, no flags, no silence budget and no participants rail.
- `R-DM-04` Lead turns are sequential. If you send a second message while the lead is replying, it is queued and answered next.
- `R-DM-05` The lead has the same read-only access as in a room: its own repo and its own ledger (invariant I8).

## What a direct chat can change

A direct chat can change only its own project, and only after you confirm (invariants I5 and I6). There are two kinds of change.

### Save a note

- `R-DM-06` The lead MAY end a reply with a proposal to record something. It renders as a card under the message: `Save to ledger: "{text}"` with "Save", "Edit" and "Dismiss".
- `R-DM-07` You MAY also select "Save to ledger" from the menu on any message in the chat. The selected message text is the proposed note, editable before saving.
- `R-DM-08` On Save, the note is written to the project's ledger and the system row `Saved to {handle} ledger` appears. On Dismiss, the card collapses to a muted "Not saved" line.
- `R-DM-09` A saved note MAY be marked as a decision. A decision made in a direct chat affects exactly one project, needs no ratification, and is recorded with source `direct`.

### Hand off work

- `R-DM-10` The lead MAY propose a handoff. It renders as a card: title, a work order of at most 10 lines, and "Send to crew", "Edit" and "Dismiss".
- `R-DM-11` On "Send to crew", the handoff is written to the ledger with status `queued`, the lead starts or instructs crew outside the chat, and the system row `Handed off to {handle} crew: {title}` appears.
- `R-DM-12` Handoff status changes (`queued`, `running`, `done`, `failed`) update the card in place. When a handoff finishes, the lead does not post a message. The card shows the result line.

## What a direct chat cannot do

- `R-DM-13` It cannot write to another project's ledger, propose a decision that names another project as affected, or hand work to another project's crew.
- `R-DM-14` If your message mentions another project, the lead answers from its own side only, and the hint from `R-UI-42` offers to start a room with both.
- `R-DM-15` If the lead concludes that what you asked for affects another project's owned surface, it MUST say so in one sentence and name the project. It MUST NOT attempt the change.

## Memory

- `R-DM-16` The lead wakes fresh for every reply (see `08-leads.md`). It receives its brief plus the most recent 40 messages of the direct chat verbatim.
- `R-DM-17` Messages older than that are not sent to the lead. You can still scroll back and read them.
- `R-DM-18` Anything that must outlive those 40 messages has to be saved to the ledger. When the lead notices you repeating a standing instruction, it SHOULD propose saving it.
- `R-DM-19` A direct chat and a room do not share transcripts. What you said to `hobbyist` in private is not visible to `hobbyist` in a room unless it was saved to the ledger.

## Differences from a room

| | Room | Direct chat |
| --- | --- | --- |
| Participants | You plus 1 to 4 leads | You plus exactly 1 lead |
| Lifetime | Temporary, ends in closed | Permanent |
| Who answers | Decided by the router | Always the lead |
| Flags and gate | Yes | No |
| Writes to ledgers | At Dispatch, to all affected projects | On your confirmation, to its own project only |
| Ratification | Yes | No |
| Lead context | Brief plus the room transcript | Brief plus the last 40 messages |
