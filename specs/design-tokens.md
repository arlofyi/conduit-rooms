# Design tokens

Generated from `~/ooozzy/conduit` at commit `27df471` (release 0.54.0) on 2026-11-21. Never author this file by hand. Regenerate it when Conduit's design changes (`R-DS-06`).

## How the design is shared

Rooms is its own app (Q1, decided 2026-11-21) built on Tailwind and HeadlessUI (decided the same day). Two options are in use:

| What | Option used | Why |
| --- | --- | --- |
| Tokens: colors, fonts, the three themes | Option 2, copy unchanged | Conduit is a single private package (`"private": true`, no workspace packages). There is no shared package to import. The values are copied into Rooms' theme file with a header naming `src/themes.ts` and commit `27df471`, then exposed to Tailwind as theme variables. |
| Components | Option 3, reimplement to match | Conduit's components are tied to class names in its 7,114 line `theme.css`. Rooms rebuilds each one on HeadlessUI and Tailwind utilities, using the measurements recorded below. Small pure modules with no styling (`markdown.ts`, `fuzzy.ts`) are copied unchanged. |

Option 1 (direct import) is not possible. Every new element in `03-design-source.md` has a close Conduit ancestor (see "New elements").

## Stack

| Layer | Conduit uses | Source |
| --- | --- | --- |
| Shell | Tauri 2 (Rust backend, WKWebView frontend) | `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` |
| UI framework | React 19, no StrictMode | `package.json`, `src/main.tsx` |
| Language | TypeScript 5.8 | `package.json` |
| State | Zustand 5, one store | `src/store.ts` |
| Styling | One plain CSS file, class names, CSS custom properties. No Tailwind, no CSS modules, no CSS-in-JS. | `src/theme.css` (7,114 lines) |
| Component library | None. Hand-written components. | `src/components/` |
| Icons | Hand-written inline SVG, stroke based | `src/components/Icons.tsx` |
| Markdown | `marked` 18 plus an allowlist sanitizer | `src/markdown.ts` |
| Build | Vite 7, pnpm 10 | `vite.config.ts`, `package.json` |
| Tests | Vitest 4 with happy-dom, WebdriverIO for e2e | `vitest.config.ts`, `wdio.conf.ts` |
| Backend storage | rusqlite (bundled SQLite), serde_json | `src-tauri/Cargo.toml` |
| Local HTTP | tiny_http (hook server) | `src-tauri/Cargo.toml` |

Window: 1100 x 720 default, minimum 980 x 600, `titleBarStyle: Overlay`, 30px drag region at the top of each column.

## Themes

Three themes. Dark and light both exist, so `R-DS-05` applies.

| Id | Label | Appearance |
| --- | --- | --- |
| `warm-near-black` | Warm Near-Black | dark (default) |
| `warm-dim` | Warm Dim | dark |
| `warm-light` | Warm Light | light |

Switching mechanism (`src/themes.ts`): `applyTheme(id)` writes every CSS variable onto `document.documentElement` and sets `data-theme`. The preference (`ThemeId` or `"auto"`) is stored in `localStorage["conduit.theme"]`. `auto` maps system dark to `warm-near-black` and system light to `warm-light`, and follows `prefers-color-scheme` live. The theme is applied before first paint in `main.tsx`.

## Color tokens

Source: `src/themes.ts` `THEMES[*].cssVars`, mirrored in `src/theme.css` `:root`.

| Token | warm-near-black | warm-dim | warm-light | Role |
| --- | --- | --- | --- | --- |
| `--accent` | `#ce8a6e` | `#d2906f` | `#b5613f` | Accent, primary button, selection wash, links |
| `--panel-bg` | `#151110` | `#211d1a` | `#f6f1e9` | Main background |
| `--sidebar-bg` | `#1b1917` | `#2a2420` | `#efe7da` | Sidebar, headers, raised surface |
| `--selection-bg` | `#272523` | `#383029` | `#e4d8c6` | Selected row, second surface |
| `--border` | `#2a2522` | `#3b332c` | `#ddd2c2` | All 1px borders and dividers |
| `--text-bright` | `#ece8e4` | `#ece6df` | `#2c2622` | Primary text |
| `--text-mid` | `#968d86` | `#ab9f95` | `#6f655a` | Secondary text |
| `--text-dim` | `#5e574f` | `#75695f` | `#9c9286` | Muted text. Lowest level allowed (`R-UI-64`). |
| `--green` | `#88b07c` | `#8fb37f` | `#5d7c4d` | Success |
| `--amber` | `#c2a063` | `#c8a667` | `#8f6a25` | Warning |
| `--red` | `#c97a72` | `#ce8079` | `#b04a42` | Danger |
| `--pill-needs-bg` | `#2a1c13` | `#3a2818` | `#f0dcc8` | "Needs you" pill background |
| `--pill-needs-text` | `#e0a580` | `#e7ab83` | `#9a4f2c` | "Needs you" pill text |
| `--chip-bg` | `#241a13` | `#342618` | `#ece0cf` | Chip background |
| `--chip-text` | `#c99b86` | `#d2a78f` | `#8a5a3f` | Chip text |
| `--tag-chip-bg` | `#20271a` | `#28321d` | `#dfe7d2` | Green tag chip background |
| `--tag-chip-text` | `#88b07c` | `#8fb37f` | `#4f6a3f` | Green tag chip text |
| `--hover` | `rgba(255,255,255,0.03)` | `rgba(255,255,255,0.03)` | `rgba(0,0,0,0.04)` | Row hover |
| `--term-bg` | `#151110` | `#211d1a` | `#f6f1e9` | Terminal background |
| `--term-fg` | `#d2ccc4` | `#d8d2ca` | `#41382f` | Terminal text |
| `--hq-grid-line` | `rgba(255,255,255,0.04)` | same | `rgba(0,0,0,0.05)` | Chat backdrop grid |

There is no separate "info" semantic color. Conduit uses `--text-mid` for neutral notices and `--accent` for emphasis.

Derived colors are never new literals. Conduit builds them with `color-mix(in srgb, var(--token) N%, transparent)`. Rooms MUST do the same (`R-DS-01`). The common mixes:

| Use | Expression |
| --- | --- |
| Text selection | `color-mix(in srgb, var(--accent) 32%, transparent)` |
| Accent soft fill | `color-mix(in srgb, var(--accent) 18%, transparent)` |
| Accent soft line | `color-mix(in srgb, var(--accent) 34%, transparent)` |
| Selected palette row | `color-mix(in srgb, var(--accent) 16%, transparent)` |
| Focus ring | `2px solid color-mix(in srgb, var(--accent) 70%, transparent)`, offset 1px |
| Semantic badge border | `color-mix(in srgb, var(--green or --amber or --red) 40%, transparent)` |
| Warning notice fill | `color-mix(in srgb, var(--amber) 8%, transparent)` |
| Error notice fill | `color-mix(in srgb, var(--red) 9%, transparent)` |

### Chat surface aliases

Conduit's two chat surfaces (HQ root chat and the session chat) scope a second set of names under `.root-chat, .chat-pane` (`theme.css:5477`). All derive from the tokens above.

| Alias | Value |
| --- | --- |
| `--hq-bg` | `var(--panel-bg)` |
| `--hq-surface` | `var(--sidebar-bg)` |
| `--hq-surface-2` | `var(--selection-bg)` |
| `--hq-line` | `var(--border)` |
| `--hq-line-2` | `color-mix(in srgb, var(--border) 55%, var(--text-dim))` |
| `--hq-ink` | `var(--text-bright)` |
| `--hq-ink-2` | `color-mix(in srgb, var(--text-bright) 45%, var(--text-mid))` |
| `--hq-ink-3` | `var(--text-mid)` |
| `--hq-rose` | `var(--accent)` |
| `--hq-rose-2` | `color-mix(in srgb, var(--accent) 85%, #000)` |
| `--hq-rose-soft` | `color-mix(in srgb, var(--accent) 18%, transparent)` |
| `--hq-rose-line` | `color-mix(in srgb, var(--accent) 34%, transparent)` |
| `--hq-warn`, `--hq-ok`, `--hq-bad` | `var(--amber)`, `var(--green)`, `var(--red)` |

## Typography

| Token | Value |
| --- | --- |
| `--ui-font` | `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif` |
| `--mono-font` | `"SF Mono", SFMono-Regular, Menlo, monospace` |

No web fonts. `-webkit-font-smoothing: antialiased` on `body`.

Conduit has no named type scale. These are the sizes it actually uses, by frequency in `theme.css`:

| Size | Count | Used for |
| --- | --- | --- |
| 11px | 105 | Section labels, header buttons, metadata, dividers |
| 12px | 96 | Sidebar rows, buttons, inputs, dropdowns. The default chrome size. |
| 10px | 46 | Uppercase group labels |
| 11.5px | 42 | Notices, tool lines, timestamps, descriptions |
| 13px | 32 | Header titles, empty state text, list rows in chat |
| 10.5px | 19 | Badges, chips, hints |
| 12.5px | 10 | Project names, inline code in chat |
| 14px | 9 | Chat message body |
| 15px | 3 | Composer textarea |
| 16px | 5 | Modal and empty state titles |

Weights: 400 body, 500 header title and primary button, 600 names and titles. Line height: 1.55 to 1.6 for chat bodies, 1.5 for notices, 1 for controls. Letter spacing: `0.15px` on project names, `0.04em` to `0.08em` on uppercase labels.

Text selection is off app-wide (`user-select: none` on `body`) and turned back on for inputs and reading surfaces. The message stream MUST opt in.

## Spacing and layout

No spacing scale. Observed values:

| Element | Value | Source |
| --- | --- | --- |
| Sidebar width | `var(--sidebar-w, 232px)`, minimum 200px, user resizable | `theme.css:102` |
| Right panel width | `var(--right-w, 300px)`, minimum 240px, user resizable | `theme.css:206` |
| Centre minimum width | 360px | `theme.css:121` |
| Titlebar drag region | `--titlebar-h: 30px` | `theme.css:32` |
| Tab strip height | `--tabstrip-h: 34px` | `theme.css:33` |
| Sidebar scroll padding | 6px | `theme.css:262` |
| Sidebar row padding | `4px 7px`, gap 7px | `theme.css:410` |
| Sidebar section label padding | `8px 7px 2px` | `theme.css:278` |
| Header padding | `9px 14px` (session header), `10px 20px` (chat head) | `theme.css:691`, `3848` |
| Chat scroll padding | `24px 20px` | `theme.css:5594` |
| Chat column | max width 720px, centred, 14px gap between items | `theme.css:5595` |
| Composer dock padding | `12px 20px 16px` | `theme.css:5749` |
| Resizer hit area | 5px | `theme.css:216` |

These override the spec fallbacks: sidebar 232px (not 240), right rail 300px (not 280), window minimum 980px (not 960).

## Shape

| Property | Values |
| --- | --- |
| Border width | 1px everywhere. 2px only on avatars. |
| Radius, rows | 5px |
| Radius, buttons, inputs, dropdown triggers, notices | 6px |
| Radius, menus, cards, code blocks, toasts | 8px |
| Radius, cards in chat (question, plan, insight, decision) | 10px |
| Radius, modal | 12px |
| Radius, composer | 24px (hero), 18px (docked in a thread) |
| Radius, pills, chips, badges | 999px |
| Radius, avatar | 28% |
| Shadow, menu | `0 8px 24px rgba(0, 0, 0, 0.35)` |
| Shadow, modal and palette | `0 12px 40px rgba(0, 0, 0, 0.4)` and `0.45` |
| Shadow, floating card | `0 6px 24px -8px rgba(0, 0, 0, 0.5)` |
| Shadow, toast | `0 4px 16px rgba(0, 0, 0, 0.35)` |
| Scrollbar | 8px wide, thumb `var(--border)` radius 4px, transparent track |

## Iconography

`src/components/Icons.tsx`: inline SVG, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth 1.8`, round caps and joins. Default sizes 12 to 14px. Icons inherit text color.

Existing icons: `FolderIcon`, `FolderPlusIcon`, `TerminalIcon`, `PlusIcon`, `EllipsisIcon`, `RefreshIcon`, `CodeIcon`, `FileIcon`, `ChevronRightIcon`, `GitBranchIcon`, `CloseIcon`, `ClockIcon`, `CircleIcon`, `CircleDashedIcon`, `CircleFilledIcon`, `ArrowUpIcon`, `ChatBubbleIcon`, `InfoIcon`.

A new icon MUST be drawn in the same style in the same file. No icon library may be added (`R-DS-02`).

## Motion

| Use | Value |
| --- | --- |
| Hover background, border, color | 100 to 150ms, `ease` or `ease-out` |
| Control state (button, input) | `120ms ease-out` |
| Switch thumb, disclosure | `160 to 180ms cubic-bezier(0.22, 1, 0.36, 1)` |
| Chevron rotate | `0.16s cubic-bezier(0.4, 0, 0.2, 1)` |
| Composer focus | `0.3s` on border, background, shadow |
| Activity pulse | `hq-pulse 1.2s ease-in-out infinite` (opacity 1 to 0.35) |
| Attention breathe | `avatar-breathe 1.6s ease-in-out infinite` |

Every animation has a `prefers-reduced-motion: reduce` override that removes it. Rooms MUST do the same. Nothing in Conduit animates layout on message arrival.

## Voice

- Sentence case for buttons, labels, titles and menu rows ("New session", "New chat"). Conduit is not fully consistent: the sidebar footer says "Add Project". Rooms uses sentence case.
- No trailing punctuation in buttons or labels. Full sentences in descriptions and empty states end with a period.
- Uppercase only for small group labels, done in CSS (`text-transform: uppercase`), never in the string.
- Empty states: one short title (16px, weight 500) and one plain sentence (13px, `--text-mid`, max 320px).
- Errors state what failed in plain words. No exclamation marks.

## Reusable components

| Component | File | Classes | Notes |
| --- | --- | --- | --- |
| `Button` | `src/components/ui.tsx:18` | `.ui-btn`, `-secondary`, `-primary`, `-ghost`, `-danger`, `-sm` (26px), `-md` (30px) | The one button. |
| `ButtonRow` | `src/components/ui.tsx:41` | `.ui-btn-row` | Gap 8px, end or start aligned. |
| `Switch` | `src/components/ui.tsx:55` | `.ui-switch` | 28 x 16. |
| `Segmented` | `src/components/ui.tsx:93` | `.ui-seg`, `.ui-seg-item` | One of N. |
| `Badge` | `src/components/ui.tsx:125` | `.ui-badge`, tones `neutral`, `accent`, `muted`, `good`, `warn`, `bad` | 17px tall pill, 10.5px text. |
| `Notice` | `src/components/ui.tsx:175` | `.ui-notice`, tones `info`, `warn`, `error` | Inline notice and banner. |
| `SettingsSection`, `SettingRow` | `src/components/ui.tsx:145`, `202` | `.ui-section`, `.setting-row` | Grouped surface of rows. |
| Text input, textarea | CSS only | `.ui-input`, `.ui-textarea` | 26px tall, 6px radius. |
| `Dropdown` | `src/components/Dropdown.tsx` | `.dd`, `.dd-trigger`, `.dd-menu`, `.dd-row`, `.dd-group` | The popover menu pattern. |
| Command palette | `src/components/CommandPalette.tsx`, `QuickOpen.tsx` | `.palette`, `.palette-input`, `.palette-row` | Top anchored, fuzzy (`src/fuzzy.ts`). Basis for Cmd+K. |
| Modal | CSS only | `.modal-backdrop`, `.modal`, `.modal-actions` | Centred, 12px radius, max 80vh. |
| Toasts | `src/components/Toasts.tsx` | `.toasts`, `.toast` | Bottom centre. |
| Sidebar rows | `src/components/Sidebar.tsx` | `.sidebar`, `.sidebar-scroll`, `.section-label`, `.project-head`, `.session-row`, `.new-session` | Selected row is `.session-row.selected`. |
| Header | CSS only | `.session-header`, `.header-btn`, `.chat-head`, `.chat-title` | |
| Empty state | CSS only | `.empty-state` with `.big-icon`, `.title`, `.sub` | |
| Avatar | `src/avatars.tsx`, `src/avatarId.ts` | `.session-avatar`, tones `running`, `needs`, `idle`, `stopped`, `visitor` | Animal glyph chosen by hashing a key. |
| Chat thread | `src/components/RootChatView.tsx`, `SessionChat.tsx`, `src/chatItems.ts` | `.hq-scroll`, `.hq-column`, `.hq-assistant`, `.hq-bubble-user`, `.hq-divider`, `.hq-note`, `.hq-pulse`, `.hq-working` | |
| Composer | same | `.hq-composer`, `.hq-composer-foot`, `.hq-chip`, `.hq-send`, `.hq-stop`, `.hq-thread-composer` | |
| Markdown | `src/markdown.ts` | Rendered into `.hq-assistant` | `renderMarkdown`, `sanitizeHtml`. |
| Error boundary | `src/components/ErrorBoundary.tsx` | | |
| Resizers | `src/App.tsx`, `src/layout.ts` | `.resizer`, `.sidebar-resizer` | |

| Drawer | `src/components/SessionDrawer.tsx` | `.session-drawer`, `-hd`, `-name`, `-meta`, `-x`, `-body` (`theme.css:6761`) | Right-anchored, 420px, max 90%, `--sidebar-bg`, left border, shadow `-12px 0 30px rgba(0, 0, 0, 0.35)`. Escape closes. |

Conduit has no bottom sheet and no tooltip component. Tooltips are the native `title` attribute.

## New elements, and what each is built from

| New element | Built from |
| --- | --- |
| Message row | `.hq-assistant` text styles (14px, line height 1.6) inside `.hq-column`, plus `.session-avatar` for the avatar. |
| Mention pill | `.hq-chip` (accent soft fill, accent soft line, 999px radius), at the body's font size instead of mono 10.5px. |
| Composer | `.hq-composer` docked with `.hq-thread-composer`, `.hq-send`, `.hq-stop`. |
| `@` picker | `.dd-menu` with `.dd-row`, opened upward (`.dd-menu.up`), selected row as `.palette-row.selected`. |
| Participant row | `.session-row` at two lines, status word in 11px `--text-mid`. |
| Flag dot and line | 8px dot in `var(--amber)` (as `.hq-pulse` without the animation), line in 11.5px `--text-mid`. |
| System row | `.hq-divider` for date dividers, `.hq-note` for events. |
| Activity indicator | `.hq-pulse`. |
| Spinner | `todo-spin` keyframes (`theme.css:1584`, 2.5s linear, as on `.todo .ic.in_progress`) on a dashed circle icon in `--accent`. |
| Ratify sheet | No sheet exists. Build from `.modal` surface (`--panel-bg`, 1px `--border`, 12px top radius) docked to the bottom of the centre column. |
| Decision card | `.hq-question` (1px border, 10px radius, soft fill). |
| Verdict chip | `Badge` with tone `good`, `warn`, `bad`. |
| Closed banner | `Notice` tone `info`. |
| Brief sheet | `.session-drawer` as is. |
| Error row | `Notice` tone `error`. |

## What is copied and what is rebuilt

| Source in Conduit | In Rooms |
| --- | --- |
| `src/themes.ts` `cssVars` for the three themes | Copied unchanged into the theme file |
| `src/themes.ts` `applyTheme`, `resolveThemeId`, stored preference | Same mechanism and same `localStorage` key shape, without the xterm and Monaco registries |
| `src/components/Icons.tsx` | Copied unchanged. New icons are added in the same style. |
| `src/markdown.ts` | Copied unchanged |
| `src/fuzzy.ts` | Copied unchanged when the quick switcher is built |
| `src/layout.ts` `projectAccent` | Copied unchanged, for avatar tints |
| `src/components/ui.tsx`, `Dropdown.tsx`, `Toasts.tsx`, `SessionDrawer.tsx` | Rebuilt on HeadlessUI and Tailwind to the measurements in this file |
| `src/theme.css` | Not copied. It is the reference the rebuilt components are checked against. |
