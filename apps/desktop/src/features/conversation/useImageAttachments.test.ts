import { SESSION_IMAGE_MAX_BYTES, SESSION_IMAGES_MAX } from "@rooms/shared";
import { describe, expect, it } from "vitest";
import { choose } from "./useImageAttachments";

const file = (name: string, type: string, size = 10) => {
  const made = new File(["x"], name, { type });
  Object.defineProperty(made, "size", { value: size });
  return made;
};

const names = (files: File[]) => files.map((entry) => entry.name);

describe("choose", () => {
  it("takes pictures and says nothing when all of them fit", () => {
    const { taken, turnedAway } = choose([file("a.png", "image/png"), file("b.jpg", "image/jpeg")], 6);

    expect(names(taken)).toEqual(["a.png", "b.jpg"]);
    expect(turnedAway).toBeNull();
  });

  it("turns away files that are not pictures, and says so", () => {
    const { taken, turnedAway } = choose([file("notes.pdf", "application/pdf"), file("a.png", "image/png")], 6);

    expect(names(taken)).toEqual(["a.png"]);
    expect(turnedAway).toContain("Only PNG");
  });

  it("turns away a picture that is too large", () => {
    const { taken, turnedAway } = choose([file("huge.png", "image/png", SESSION_IMAGE_MAX_BYTES + 1)], 6);

    expect(taken).toEqual([]);
    expect(turnedAway).toContain("5 MB");
  });

  it("takes only as many as there is room for", () => {
    const offered = [file("a.png", "image/png"), file("b.png", "image/png"), file("c.png", "image/png")];
    const { taken, turnedAway } = choose(offered, 2);

    expect(names(taken)).toEqual(["a.png", "b.png"]);
    expect(turnedAway).toContain(`${SESSION_IMAGES_MAX} pictures`);
  });
});
