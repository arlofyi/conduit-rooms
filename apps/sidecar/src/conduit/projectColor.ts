/**
 * Copied unchanged from ~/ooozzy/conduit src/layout.ts (commit 27df471):
 * projectHue, PROJECT_PALETTE and projectAccent. A project with no color
 * chosen in Conduit gets the same derived color here as it shows there.
 */

function projectHue(projectId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < projectId.length; i++) {
    h ^= projectId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ((h % 360) * 137) % 360;
}

const PROJECT_PALETTE = [
  "#c4906c", // Terracotta
  "#c9a86b", // Ochre
  "#b8b072", // Sand
  "#93ad7c", // Sage
  "#75a898", // Seafoam
  "#7c9fb8", // Slate
  "#9691c4", // Lavender
  "#b989b1", // Mauve
  "#c47f88", // Rose
  "#a89383", // Driftwood
] as const;

export function projectAccent(projectId: string): string {
  return PROJECT_PALETTE[projectHue(projectId) % PROJECT_PALETTE.length]!;
}
