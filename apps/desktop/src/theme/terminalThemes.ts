import type { ITheme } from "@xterm/xterm";
import type { ThemeId } from "./themes";

/**
 * Terminal colors for each theme. Copied unchanged from ~/ooozzy/conduit
 * src/themes.ts (commit 27df471), THEMES[*].terminal, so a session's
 * terminal looks here exactly as it does in Conduit.
 */
export const TERMINAL_THEMES: Record<ThemeId, ITheme> = {
  "warm-near-black": {
    background: "#151110", foreground: "#d2ccc4", cursor: "#ce8a6e",
    cursorAccent: "#151110", selectionBackground: "#33302c",
    black: "#15161e", red: "#c97a72", green: "#88b07c", yellow: "#c2a063",
    blue: "#ce8a6e", magenta: "#b98ba6", cyan: "#7fa6a0", white: "#a9a199",
    brightBlack: "#4a4540", brightRed: "#c97a72", brightGreen: "#88b07c",
    brightYellow: "#c2a063", brightBlue: "#ce8a6e", brightMagenta: "#b98ba6",
    brightCyan: "#7fa6a0", brightWhite: "#d2ccc4",
  },
  "warm-dim": {
    background: "#211d1a", foreground: "#d8d2ca", cursor: "#d2906f",
    cursorAccent: "#211d1a", selectionBackground: "#3f372f",
    black: "#2a2420", red: "#ce8079", green: "#8fb37f", yellow: "#c8a667",
    blue: "#d2906f", magenta: "#c093ad", cyan: "#86ada6", white: "#ab9f95",
    brightBlack: "#5b5249", brightRed: "#ce8079", brightGreen: "#8fb37f",
    brightYellow: "#c8a667", brightBlue: "#d2906f", brightMagenta: "#c093ad",
    brightCyan: "#86ada6", brightWhite: "#ece6df",
  },
  "warm-light": {
    background: "#f6f1e9", foreground: "#41382f", cursor: "#b5613f",
    cursorAccent: "#f6f1e9", selectionBackground: "#e0d2bd",
    black: "#41382f", red: "#b04a42", green: "#5d7c4d", yellow: "#8f6a25",
    blue: "#b5613f", magenta: "#8c5878", cyan: "#3f7a72", white: "#6f655a",
    brightBlack: "#9c9286", brightRed: "#b04a42", brightGreen: "#5d7c4d",
    brightYellow: "#8f6a25", brightBlue: "#b5613f", brightMagenta: "#8c5878",
    brightCyan: "#3f7a72", brightWhite: "#2c2622",
  },
};
