/**
 * Project handles: what you type after "@". Lowercase, 2 to 32 characters,
 * a-z, 0-9 and "-" only, unique across the workspace (specs/02-concepts.md).
 */

export const HANDLE_MIN = 2;
export const HANDLE_MAX = 32;

const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function isValidHandle(value: string): boolean {
  return (
    value.length >= HANDLE_MIN &&
    value.length <= HANDLE_MAX &&
    HANDLE_PATTERN.test(value)
  );
}

/** "Milega.pk" becomes "milega-pk". Falls back to "project" for names with no usable characters. */
export function slugifyHandle(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, HANDLE_MAX)
    .replace(/-+$/, "");

  if (slug.length >= HANDLE_MIN) return slug;
  return slug.length === 0 ? "project" : `${slug}-project`.slice(0, HANDLE_MAX);
}

/** Appends -2, -3 and so on until the handle is free, keeping it within the length limit. */
export function uniqueHandle(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;

  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = base.slice(0, HANDLE_MAX - suffix.length) + suffix;
    if (!taken.has(candidate)) return candidate;
  }
}
