/**
 * Prepares a page an agent wrote for showing inside the app.
 *
 * The page runs in a frame with no access to the app (see ArtifactPanel).
 * This adds the second lock: a content security policy, placed before
 * anything of the page's own, that lets it use inline styles and scripts,
 * fonts from Google, and scripts from three well-known library hosts, and
 * lets it make no network request of its own. So a page cannot send what it
 * was given anywhere, and cannot pull in code from a place nobody chose.
 */

const POLICY = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com data:",
  "img-src data: blob:",
  "media-src data: blob:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

const LOCK = `<meta http-equiv="Content-Security-Policy" content="${POLICY}">`;

/** The page with the policy as its first element, where no earlier tag of the page's can pre-empt it. */
export function sealArtifact(html: string): string {
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html)?.[0] ?? "";
  return `${doctype || "<!doctype html>"}${LOCK}${html.slice(doctype.length)}`;
}
