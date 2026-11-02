# Squeek Ledger design

## Overview

Squeek Ledger is an address lookup and analysis tool for Squeek holders. Pixel headings and DotGrid art carry the Squeekchain identity; warm paper surfaces in light mode and muted purple surfaces in dark mode support ordinary UI text and numerical data. The revision preserves the existing CSS and composition.

The source of truth for tokens and layout is `src/styles.css`. Shared components live in `src/components/ui.tsx`, with the address field in `src/components/AddressForm.tsx` and the site shell in `src/App.tsx`.

## Colors

Colors use hex CSS custom properties. Dark values override the same roles under `[data-theme="dark"]`.

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--bg` | `#f6f1e7` | `#16141a` | Page |
| `--surface` | `#fffaf1` | `#1f1c24` | Header, fields, cards, statistics |
| `--surface-2` | `#efe6d6` | `#2a2630` | Image placeholders, progress track, quiet hover |
| `--ink` | `#221c16` | `#efe9df` | Primary text |
| `--ink-2` | `#5a4e42` | `#b9ae9f` | Hints, metadata, secondary labels |
| `--line` | `#d9ccb6` | `#3b3542` | Structural borders |
| `--accent` | `#8a4b0f` | `#f0b35a` | Links |
| `--accent-fill` | `#a85a12` | `#f0b35a` | Primary button, current navigation underline, progress |
| `--accent-ink` | `#fffaf1` | `#1a1408` | Primary-button text |
| `--ok` | `#2f6b3a` | `#8fd19e` | Staked badge, live marker |
| `--warn-bg` | `#fbecc8` | `#3a2f17` | Warning surface |
| `--warn-line` | `#d9a640` | `#a07a2a` | Warning border, simulation label |
| `--err-bg` | `#f8dcd6` | `#3d1f1b` | Error surface |
| `--err-line` | `#c4523f` | `#b5574a` | Error border/marker |
| `--focus` | `#1f5fbf` | `#8ab4ff` | Keyboard focus |

Theme initializes from the saved preference, then the system color scheme. The header's Dark/Light button changes and saves it. Status text accompanies color. Measured contrast coverage and its limits are recorded in `artifacts/validation.md`; these token values alone are not a contrast certification.

## Typography

`--font-pixel` is `"Silkscreen", ui-monospace, monospace`. Its local regular 400 font is imported through `@fontsource/silkscreen/400.css` in `src/main.tsx`. It is used for the brand, page/section headings and token IDs on cards. `--font-ui` is `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` for prose, fields, labels and data.

| Token | Size | Use |
| --- | --- | --- |
| `--fs-1` | 28px, 22px at widths ≤480px | Page heading |
| `--fs-2` | 22px | Statistic values |
| `--fs-3` | 18px | Section headings, brand, card IDs, quiet statistics |
| `--fs-body` | 16px | Body, controls |
| `--fs-small` | 14px | Hints, table text, metadata, secondary text |

UI weights are 400 and 600; pixel headings use 400. Body line height is 1.5, pixel headings 1.2, statistic values 1.25, and buttons 1. Letter spacing remains natural. Body numbers use `tabular-nums`. `.lede` has a 60ch measure; `.small` text and notices are limited to 75ch. Text can wrap with `overflow-wrap: anywhere`; full account addresses additionally use `word-break: break-all`. Inputs stay at 16px on phones. Loaded Silkscreen faces were checked in Chromium.

## Layout

The spacing tokens are `--space-1` through `--space-6`: 4, 8, 12, 16, 24 and 40px. `.wrap` provides a 1080px maximum width, centered with 16px inline padding. The brand begins at the shared leading edge, with theme utility at the trailing edge and navigation below.

Statistics use an auto-fill grid with a 150px minimum, constrained to the available width. Holding cards use a 240px minimum. Rows of actions wrap. Tables scroll within `.table-wrap` when their columns need more room; the document itself must not scroll horizontally at the tested LTR widths.

At widths ≤480px the wallet field and Look up button stack, the button fills the available width, the page heading becomes 22px, and the network pill is hidden. The product, field and primary action remain on the first 390px-wide screen.

Below 840px, token details and the merge planner are single-column. At ≥840px, token details use a 340px art column plus flexible information column; art becomes sticky with a 16px top inset. The planner uses a 320px picker plus flexible results. The picker list scrolls within a 60vh maximum height. The English/LTR layouts were checked at 320, 390 and 1440px in both themes. Forced RTL is not a supported localization; see validation.

## Elevation & Depth

The interface is flat: no drop shadows or floating panels. Surface tones and 1px borders distinguish statistics, cards and fields. Notices use a 4px leading border. The keyboard skip link becomes visible above the header with `z-index: 10` when focused.

## Shapes

`--radius` is 4px for controls, cards, notices, badges, image frames and the progress track. The desktop network pill uses a 999px radius. Fields/buttons use 2px borders; ordinary structural borders are 1px. DotGrid images use pixel rendering and are shown through `<img>`, never injected SVG markup. The progress fill uses the existing segmented stripe pattern.

## Components

| Component/pattern | Source | Behavior |
| --- | --- | --- |
| `AddressForm` | `src/components/AddressForm.tsx` | Labeled 48px field and Look up button; validates on submit with an associated alert; route changes synchronize value and clear errors |
| `.btn`, `.btn-quiet`, `.btn-sm` | `src/styles.css` | Filled primary or bordered secondary action; hover feedback, visible focus, disabled opacity; 48px normal/44px small minimum height |
| Navigation and skip link | `src/App.tsx` | Native links, current-page underline; skip prevents fragment routing, focuses `main` and scrolls to it |
| `Stat` | `src/components/ui.tsx` | Definition-list label, prominent value and optional source/note |
| `Notice`, `ErrorNotice`, `Loading`, `Gate` | `src/components/ui.tsx` | Textual info/warning/error states; HTTP errors can retry; loading has a status label; unavailable means unknown |
| Holding card and `SqueekImage` | `src/pages/Home.tsx`, `src/components/ui.tsx` | Native token link, lazy API metadata, fixed image slot, level/power/custody badges, image fallback |
| History table | `src/pages/Squeek.tsx` | Event/time/transaction columns, transfer parties, donor/survivor wording, Etherscan links; unavailable searches show an incomplete notice and retry, retaining known rows |
| Planner picker/result | `src/pages/Merge.tsx` | Native labeled checkboxes, clear action, persistent local selection and explicitly labeled simulation |
| Network progress | `src/pages/Network.tsx` | Named progressbar, numerical state and refresh status; retains a reading through transient poll errors |

Keyboard controls use a 3px `--focus` outline with a 2px offset. The focused main landmark omits that outline. Loading blinks with stepped timing and progress width transitions over 400ms; reduced-motion mode stops both. Buttons transition only background and text colors over 120ms. There are no overlays or modal focus traps.

## Do's and Don'ts

- Start a page with `.wrap`/`.section`, one `.pixel.h1`, then the relevant existing components and source links.
- Use the existing scale and semantic color roles. Keep prose in the UI font and pixel type for headings/identity.
- Place instructions beside controls; preserve the address lookup on the first mobile screen.
- Distinguish empty, loading, unknown and failure states. Only show a definitive empty history after an available search finishes.
- Reuse quiet buttons for secondary actions and the existing error/retry pattern for recoverable failures.
- Keep API values and simulation labels explicit. Preserve keyboard navigation, relative static assets and the document's stable base when adding routes.

Review method: pinned Better Interface guidance by [Jakub Krehel](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface) (MIT); documentation method by [Paul Bakaus, Impeccable](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md) (Apache-2.0). This document describes the implementation; the guides are not redistributed.
