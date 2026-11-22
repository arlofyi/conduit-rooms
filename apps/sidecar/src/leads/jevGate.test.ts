import type { Project } from "@rooms/shared";
import { describe, expect, it } from "vitest";
import { pick } from "./jevGate";

const project = (handle: string): Project => ({
  id: handle,
  kind: "project",
  handle,
  displayName: handle,
  repoPath: `/${handle}`,
  productId: null,
  color: "#c4906c",
});

const conduit = project("conduit");
const rooms = project("rooms");
const members = [conduit, rooms].map((entry) => ({ project: entry, persona: null }));
const quiet = { group: 0.01, followUp: 0.02, lastSpeaker: null };
const handles = (decision: { speakers: Project[] }) => decision.speakers.map((speaker) => speaker.handle);

describe("pick", () => {
  it("sends a message to the lead it is plainly about", () => {
    const decision = pick(members, { conduit: 0.85, rooms: 0.14, nobody_: 0.01 }, quiet);

    expect(handles(decision)).toEqual(["conduit"]);
    expect(decision.reason).toBe("about conduit: conduit 85%, rooms 14%, nobody 1%, follow-up 2%");
  });

  it("picks the best fit even when no lead fits well, as long as nobody fits worse", () => {
    expect(handles(pick(members, { conduit: 0.46, rooms: 0.22, nobody_: 0.32 }, quiet))).toEqual(["conduit"]);
  });

  it("sends a message for the group to every lead, whatever it is about", () => {
    const decision = pick(members, { conduit: 0.01, rooms: 0.49, nobody_: 0.5 }, { ...quiet, group: 0.97 });
    expect(handles(decision)).toEqual(["conduit", "rooms"]);
  });

  it("sends a follow-up to the lead who just spoke, even when it reads as about nothing", () => {
    const decision = pick(
      members,
      { conduit: 0.05, rooms: 0.25, nobody_: 0.7 },
      { group: 0, followUp: 0.9, lastSpeaker: conduit },
    );
    expect(handles(decision)).toEqual(["conduit"]);
  });

  it("lets the subject win over the thread", () => {
    const decision = pick(
      members,
      { conduit: 0.02, rooms: 0.97, nobody_: 0.01 },
      { group: 0, followUp: 0.8, lastSpeaker: conduit },
    );
    expect(handles(decision)).toEqual(["rooms"]);
  });

  it("wakes nobody for thanks and small talk, even when it reads as a follow-up", () => {
    const decision = pick(
      members,
      { conduit: 0.03, rooms: 0.09, nobody_: 0.88 },
      { group: 0.02, followUp: 0.79, lastSpeaker: conduit },
    );

    expect(handles(decision)).toEqual([]);
    expect(decision.reason).toContain("for nobody");
  });
});
