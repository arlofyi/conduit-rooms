# 03. Design source

## The rule

**The UI comes from `~/ooozzy/conduit`. Same colors, same overall design.**

Conduit Rooms MUST look like a part of Conduit. Someone who uses Conduit daily should open Conduit Rooms and not notice a seam.

## What "comes from Conduit" covers

All of the following are taken from `~/ooozzy/conduit` and MUST NOT be reinvented:

| Area | Take from Conduit |
| --- | --- |
| Color | The full palette: backgrounds, surfaces, borders, text levels, accent, and the semantic colors for success, warning, danger and info. Light and dark themes if Conduit has both. |
| Typography | Font families (UI and monospace), the type scale, weights, line heights, letter spacing. |
| Spacing | The spacing scale and the paddings used in sidebars, lists, headers and panels. |
| Shape | Corner radii, border widths, shadows and elevation levels. |
| Iconography | The icon set, icon sizes and stroke weight. |
| Components | Buttons, inputs, list rows, sidebar sections, headers, tabs, sheets, popovers, tooltips, chips or badges, avatars, scrollbars, dividers, empty states, loading states. |
| Layout | Window chrome, sidebar width and behavior, header height, panel proportions. |
| Motion | Durations, easing curves, which things animate at all. |
| Voice | Capitalization of labels (sentence case or title case), punctuation in buttons, tone of empty states and errors. |
| Stack | Framework, styling approach, component library, state management, build tooling. Use the same unless Uzair says otherwise. |

## How to do it

Before writing any interface code, the builder MUST:

1. Read `~/ooozzy/conduit` and locate the theme or token definitions, the shared components, and the app shell (sidebar, header, main panel).
2. Write what was found into `specs/design-tokens.md` in this repo: a table of token names and values, the list of reusable components with their file paths, and the stack. This file is generated from Conduit, never authored by hand.
3. Decide how the design is shared, in this order of preference:
   1. Import Conduit's tokens and components directly, if the repos can share a package.
   2. Copy the token file and the needed components into this repo unchanged, with a comment naming the source path and the Conduit commit they were copied from.
   3. Reimplement a component only when neither is possible, matching Conduit pixel for pixel.
4. Record which option was used, and why, at the top of `specs/design-tokens.md`.

## Requirements

- `R-DS-01` No hex, rgb or hsl color value may be written in this repo's UI code unless it was copied from Conduit. Every color MUST trace to a Conduit token.
- `R-DS-02` No font, icon set or component library may be added that Conduit does not already use.
- `R-DS-03` Where this spec gives a pixel value (for example sidebar 240px), treat it as a fallback. If Conduit has an equivalent, Conduit's value wins.
- `R-DS-04` Where Conduit Rooms needs something Conduit has no equivalent for, build it from Conduit's existing tokens and nearest component. The new elements are listed below.
- `R-DS-05` If Conduit supports light and dark themes, Conduit Rooms MUST support both and follow the same switching mechanism.
- `R-DS-06` When Conduit's design changes, Conduit Rooms follows. Do not fork the look.

## Elements Conduit probably does not have

These are new. Build each from Conduit's tokens and closest existing component.

| New element | Build it from |
| --- | --- |
| Message row | Conduit's list row and its text styles. If Conduit already renders agent or terminal session output as rows, match that. |
| Mention pill | Conduit's chip or badge, using the accent color at low emphasis. |
| Composer with `@` picker | Conduit's text input plus its popover or command menu. |
| Participant row with status | Conduit's sidebar list row plus its secondary text style. |
| Flag dot and flag line | Conduit's warning semantic color for the dot, secondary text for the line. |
| System row | Conduit's divider or muted caption style. |
| Ratify sheet | Conduit's sheet, drawer or modal, whichever it uses for focused tasks. |
| Verdict chip | Conduit's badge with semantic colors: success for approve, warning for object, danger for escalate. |
| Closed banner | Conduit's inline notice or banner component. |

## What the spec author could not verify

The author of these specs did not have access to `~/ooozzy/conduit` when writing. So:

- No Conduit color, font, component name or file path appears anywhere in these specs.
- The wireframes in `04-interface.md` show structure only. They are not a visual design.
- It is assumed, not confirmed, that Conduit has a left sidebar with a project list and a main panel. If its shell is different, keep Conduit's shell and fit the three regions of `04-interface.md` into it.
