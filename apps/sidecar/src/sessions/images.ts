import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SESSION_IMAGE_TYPES, type SessionImage } from "@rooms/shared";

/**
 * Pictures sent to a session are written to the temporary folder, and the
 * session is handed the paths. This is how Conduit itself gives Claude a
 * pasted picture (src-tauri/src/clipboard.rs there): Claude Code attaches an
 * image when the path of one is pasted into its prompt.
 *
 * The files are left for the system to clear, as Conduit's are. Claude reads
 * a picture when the message is sent, and may read it again if the
 * conversation is resumed.
 */
export async function saveImages(images: readonly SessionImage[]): Promise<string[]> {
  return Promise.all(
    images.map(async (image) => {
      const path = join(tmpdir(), `conduit-rooms-paste-${randomUUID()}.${SESSION_IMAGE_TYPES[image.mediaType]}`);
      // Readable by you alone: a screenshot can hold anything.
      await writeFile(path, Buffer.from(image.data, "base64"), { mode: 0o600 });
      return path;
    }),
  );
}
