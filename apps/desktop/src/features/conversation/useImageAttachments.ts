import {
  SESSION_IMAGE_MAX_BYTES,
  SESSION_IMAGE_TYPES,
  SESSION_IMAGES_MAX,
  type SessionImage,
  type SessionImageType,
} from "@rooms/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** One picture waiting to be sent. */
export interface Attachment {
  id: string;
  file: File;
  /** A local address for drawing the picture before it is sent. */
  previewUrl: string;
  /** True for the moment after you remove it, while it shrinks away. It is no longer part of the message. */
  leaving: boolean;
}

export interface ImageAttachments {
  /** Every picture on screen, including any that is on its way out. */
  items: readonly Attachment[];
  /** How many pictures the message will carry. */
  count: number;
  /** Why the last pictures offered were not all taken, in words for the screen. Null when they were. */
  problem: string | null;
  /** Takes the pictures among these files, up to the limits. Anything else is turned away with a reason. */
  add(files: readonly File[]): void;
  /** Takes a picture off the message at once, and off the screen when it has finished leaving. */
  remove(id: string): void;
  /** Drops every picture, after a send. */
  clear(): void;
}

/** What a file chooser is told to offer. */
export const IMAGE_ACCEPT = Object.keys(SESSION_IMAGE_TYPES).join(",");

const isImage = (file: File): boolean => file.type in SESSION_IMAGE_TYPES;

/**
 * The pictures attached to a message that has not been sent yet. They live
 * here and nowhere else: unlike the text of a draft, they are not kept if you
 * leave the conversation.
 */
export function useImageAttachments(): ImageAttachments {
  const [items, setItems] = useState<Attachment[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  // A preview address holds its file in memory until it is released, so whatever is left when the box goes away is let go.
  const latest = useRef(items);
  useEffect(() => {
    latest.current = items;
  }, [items]);
  useEffect(() => () => latest.current.forEach(release), []);

  const add = useCallback((files: readonly File[]) => {
    setItems((current) => {
      const { taken, turnedAway } = choose(files, SESSION_IMAGES_MAX - staying(current).length);
      setProblem(turnedAway);
      return [...current, ...taken.map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file), leaving: false }))];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setProblem(null);
    setItems((current) => current.map((item) => (item.id === id ? { ...item, leaving: true } : item)));

    // A timer, not the animation's own end: an animation in a hidden window may never report that it finished.
    setTimeout(() => {
      setItems((current) => {
        current.filter((item) => item.id === id).forEach(release);
        return current.filter((item) => item.id !== id);
      });
    }, LEAVE_MS);
  }, []);

  const clear = useCallback(() => {
    setProblem(null);
    setItems((current) => {
      current.forEach(release);
      return [];
    });
  }, []);

  return useMemo(
    () => ({ items, count: staying(items).length, problem, add, remove, clear }),
    [items, problem, add, remove, clear],
  );
}

/** Reads attached pictures into the form a message carries them in. */
export function encodeImages(attachments: readonly Attachment[]): Promise<SessionImage[]> {
  return Promise.all(
    staying(attachments).map(async ({ file }) => ({ mediaType: file.type as SessionImageType, data: await toBase64(file) })),
  );
}

/** As long as the leaving animation runs (pop-out, in theme.css), and a little over. */
const LEAVE_MS = 180;

const staying = (attachments: readonly Attachment[]) => attachments.filter((attachment) => !attachment.leaving);

function release(attachment: Attachment): void {
  URL.revokeObjectURL(attachment.previewUrl);
}

/**
 * Picks which of the offered files to take, given how many more there is
 * room for, and says why any were left. Exported for tests.
 */
export function choose(files: readonly File[], room: number): { taken: File[]; turnedAway: string | null } {
  const pictures = files.filter(isImage);
  const small = pictures.filter((file) => file.size <= SESSION_IMAGE_MAX_BYTES);
  const taken = small.slice(0, Math.max(0, room));

  const reasons = [
    pictures.length < files.length && "Only PNG, JPEG, GIF and WebP pictures can be sent.",
    small.length < pictures.length && "A picture can be 5 MB at most.",
    taken.length < small.length && `A message can carry ${SESSION_IMAGES_MAX} pictures at most.`,
  ].filter((reason) => reason !== false);

  return { taken, turnedAway: reasons.length > 0 ? reasons.join(" ") : null };
}

/** A file's bytes as base64 text, without the "data:image/png;base64," a reader puts in front. */
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`${file.name || "A picture"} could not be read.`));
    reader.onload = () => resolve(String(reader.result).slice(String(reader.result).indexOf(",") + 1));
    reader.readAsDataURL(file);
  });
}
