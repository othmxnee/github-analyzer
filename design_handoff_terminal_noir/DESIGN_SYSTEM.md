# git·analyzer Design System

> **Terminal Noir** — a dark-first, signal-blue, mono-numeric design language
> for an engineering-intelligence platform that turns any GitHub repo into a
> living dashboard of contributor activity, knowledge distribution, hotspots,
> architecture, and developer roles.

---

## What is git·analyzer?

`git·analyzer` is a final-year-engineering-project-grade analytics product
built for **tech leads and engineering managers** who need to read a codebase
at a glance. You paste a repository URL (GitHub, GitLab, Bitbucket) and the
backend uses **PyDriller** to extract the full commit history, then computes
~15 metrics per developer and surfaces them across six dashboards:

| Section            | What you learn                                                              |
| ------------------ | --------------------------------------------------------------------------- |
| **Overview**       | Repository health score, KPI strip, key findings, recommendations           |
| **Activity**       | Commit timelines, inter-commit cadence, top developers by file mods         |
| **Knowledge & Risk** | KCI (Knowledge Concentration Index), Lorenz curve, Gini, bus factor       |
| **Hotspots**       | High-churn files (bar + treemap + Voronoi treemap)                          |
| **Architecture**   | Dependency graph (force-directed) + PageRank centrality                     |
| **Developer Roles** | K-Means clustering on 15 metrics → 7 roles, PCA skill map, radar profiles  |

The product positioning is **Linear / Vercel / Arc-tier**, not corporate BI.
Modern, vital, credible.

---

## Sources used to build this design system

| Source                 | Where                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| **Codebase (frontend)** | `frontend/` — mounted via File System Access API (React 18 + Vite)    |
| **GitHub repo**        | <https://github.com/othmxnee/github-analyzer> — stub (gitignore + README only at time of writing) |
| **Screenshots**        | 21 PNGs in `uploads/` covering hero, all 6 dashboard sections, light mode |

> The GitHub repo above is currently a placeholder — explore it to confirm
> structure if it has been populated since. The full design language is
> reverse-engineered from the **mounted frontend** at `frontend/src/styles.css`
> and `frontend/src/pages/Home.jsx`, which already implement a coherent token
> system the original author calls "Terminal Noir."

---

## Index — what's in this folder

| Path                        | Purpose                                                          |
| --------------------------- | ---------------------------------------------------------------- |
| `README.md`                 | This file — product context, fundamentals, iconography, index    |
| `SKILL.md`                  | Agent-skill manifest for Claude Code / portable use              |
| `colors_and_type.css`       | All design tokens as CSS custom properties (paste-ready)         |
| `assets/`                   | Logo lockups + icon documentation                                |
| `fonts/`                    | (empty — both faces loaded from CDN; see _Type_ below)           |
| `preview/`                  | The cards that populate the **Design System** tab                |
| `ui_kits/landing/`          | Hi-fi recreation of the landing page (hero + scroll sections)    |
| `ui_kits/dashboard/`        | Hi-fi recreation of the dashboard shell + 3 key sections         |

---

## Content fundamentals

**Voice.** Direct, declarative, faintly authoritative. The product is
addressed _to_ tech leads, not _at_ end users — so copy is short, precise, and
trusts the reader to know what a Gini coefficient is. No marketing slop.

**Tone examples (lifted from the codebase):**

- _Hero_ — "Paste a repo. See everything." (two sentences, full stops, no pep)
- _Subhead_ — "Git history doesn't lie." (a thesis, not a tagline)
- _Section eyebrows_ — "WHAT IT ANALYZES" / "SAMPLE OUTPUT" / "DEVELOPER ROLE DETECTION"
- _Recommendations_ — "Cross-train developers on core modules to raise the
  bus factor." (imperative, specific, no fluff)
- _Risk callouts_ — "Critical — single point of failure" / "Owns 43% of total repo knowledge"

**Casing.**
- Eyebrows / kickers / labels: `UPPERCASE` with `letter-spacing: .14em`
- H1/H2/H3: **Sentence case**, never Title Case
- Buttons: Sentence case with a trailing `→` for primary CTAs ("Analyze →", "Try it →", "Get started →")
- Filenames, repo slugs, numbers, terminal output: **mono**, never sans

**Pronouns.** "You" sparingly ("What you will see", "Paste a repo"). The
product never speaks in first person.

**Numerals.** Always Arabic, always in mono, often with a unit suffix in
muted text (`22 / 100`, `1,840 commits`, `0.74` Gini).

**Emoji.** **Never** in UI. The codebase actively hides emoji from old chart
titles (`.card-title span:first-child { display: none; }`). Use SVG icons.

**The vibe.** A terminal that learned typography. Particle networks idle in
the background. Stats settle in with a fade-up. Risk bars are red because
the file is on fire, not because red looks dramatic.

---

## Visual foundations

### Palette

- **Canvas** is one of three near-black blues: `#07090F` (page), `#0D1018`
  (cards), `#111520` (inputs). Differences are 3–6 percentage points of
  lightness — _legible separation without contrast theatre_.
- **One accent**, signal blue `#3B6EEA`. Used for: brand mark dot, primary
  buttons, focus rings, active nav item, hyperlinks, numeric values that
  matter. **Never two accents in one view.** Light-mode equivalent is a
  deeper `#2558D4`.
- **Three semantic colors only** — `green #00C896` (healthy / active),
  `amber #F59E0B` (warning), `red #EF4444` (danger / risk). Always paired
  with a 10–12%-alpha tint of themselves for backgrounds.
- **Role palette** is seven hues for the K-Means cluster output only; it
  doesn't appear elsewhere in the UI.

### Type

- **Satoshi 400/500/600/700** for UI and display. Loaded from
  `fonts.bunny.net` (Fontshare's free CDN). Inter is the named system
  fallback only.
- **JetBrains Mono 400/500/600** for numerics, filenames, repo slugs,
  terminal output, and timestamps. Loaded from Google Fonts.
- **No serif anywhere.** The user's brief floated Fraunces for hero
  headlines — this would conflict with the established voice and we did not
  add it. Flag this if you want a serif explored.
- Display headlines use **negative tracking** (`-.025` to `-.035em`) and
  tight line-height (`1.04`). Eyebrows go the opposite direction:
  uppercase, `.14em`, 10px.

### Spacing & layout

- 4-px base scale (`4, 8, 12, 14, 16, 20, 24, 32, 44, 64, 88`).
- Card grids use a fixed `14px` gap (`--gap-card`). Section spacing is `32px`
  (`--gap-section`), section paddings are `88px` top/bottom on landing.
- Dashboard is **fixed sidebar (224px)** + **fixed topbar (52px)** + scrolling
  main. Landing maxes at `1060px` and centers.

### Radii

`8px` for inputs/buttons/pills, `12px` for cards, `16px` for the hero
input island, `999px` for badge pills and the theme toggle track.

### Borders

A two-tier system: `--b` (8% white-on-dark, hairline) and `--bs` (15%,
strong/hover). Every card has a `--b` border by default and animates to
`--bs` on hover — _no shadow change_, just the border firms up.

### Shadows

Used sparingly. Three tiers: `--shadow-subtle` (small dropdowns),
`--shadow-soft` (modals), `--shadow-island` (the hero input box, which is
the one element that genuinely floats). Cards do **not** carry shadows in
the default state.

### Backgrounds & motifs

- **Particle network canvas** behind the landing hero — 42 nodes drifting
  on a slow random walk, edges drawn when nodes are within 130px,
  desaturated blue. This is _the_ brand motif; lean on it.
- **PCA scatter** behind the Developer Roles section — same canvas
  language, applied to data.
- **Voronoi treemap** in Hotspots — red-saturated diagram-as-art.
- No gradients, no glass blobs, no aurora, no mesh. Frosted-glass blur is
  reserved for the **topbar** (`backdrop-filter: blur(18px)` over a 92%-opaque
  bg) and the **hero island** (`blur(12px)` over a 90% bg).

### Motion

- Default easing is **expo-out** (`cubic-bezier(0.16, 1, 0.3, 1)`), durations
  cluster around **150–300ms** for hover/state and **500–650ms** for the
  scroll-reveal fade-up.
- Scroll reveal is the only macro animation on landing: opacity 0→1 +
  translateY 18px→0 over 650ms when the element enters viewport.
- Hover lifts are **border-color only**, never `translateY`. The exception
  is the hero scroll-hint chevron, which bounces 6px every 2s.
- Numeric counters should animate from 0 to value over ~600ms — _the user
  requested this and the codebase doesn't yet implement it; please flag the
  gap or accept the suggestion_.

### Hover / press states

- **Hover:** border `--b → --bs`, background `--surf → --surf2`, text
  `--t2 → --t`. Buttons drop to `opacity: 0.85`.
- **Press / disabled:** `opacity: 0.5`, `cursor: not-allowed`. No transforms.
- **Focus:** input rows get a 3px `--ac-d` ring + `--ac` border.

### Transparency & blur

- `rgba(13,16,24,0.9)` + `backdrop-filter: blur(12px)` → hero island
- `rgba(7,9,15,0.92)` + `backdrop-filter: blur(18px)` → fixed topbar / nav
- Everything else is **opaque**. Don't put glass on cards or buttons.

### Imagery

There is none. The product is a chart machine; visual interest comes from
the data and the particle motif, not photography or illustration. If a hero
image were ever needed, it should be **B&W or grayscale photography with a
subtle blue color cast**, never warm or saturated.

### Cards

```
background:   var(--bg2)        (#0D1018)
border:       1px solid var(--b) (8% white)
border-radius: 12px
padding:      14px–18px header, 18px body
shadow:       none
hover:        border → var(--bs)
```

Card title sits on a 1-px bottom border, 12px font, 600 weight. Mono
metadata aligns right.

---

## Iconography

> **Stroke icons, never filled. 24×24 viewBox, 1.5–2 stroke, rounded caps.**

The codebase ships its own hand-rolled SVG icons inline as React components
(see `components/Charts/...` and the `Icon` map in `pages/Dashboard.jsx`).
They follow the **Feather Icons** / **Lucide** family — same metrics, same
caps, same general silhouettes.

- **Stroke weight:** `2` (most), `2.5` for the download arrow only.
- **Cap / join:** `stroke-linecap="round"`. (Joins inherit miter.)
- **Color:** always `currentColor` so they pick up the parent text color
  (`--t2` muted, `--t` active, `--ac` selected, `--red`/`--amber`/`--green`
  semantic).
- **Sizing:** `12–14px` inside controls and nav, `18–22px` in feature cards,
  `36px` square in the colored "icon tile" pattern (rounded `8px` tile with
  `--ac-d` background and `--ac-b` border).

**Emoji are forbidden.** The codebase actively suppresses emoji from
legacy section titles via CSS.

**Unicode chars** are used sparingly and intentionally: `·` (middle dot) in
the wordmark `git·analyzer` and `→` (right arrow) at the end of primary
CTAs. Nothing else.

**No icon font** is loaded. Icons live in JSX. If you need to add icons in
a new mock, use **Lucide** via CDN (`https://unpkg.com/lucide@latest`) — it
matches the existing set 1:1.

See `assets/ICONOGRAPHY.md` for a fuller key and copy-paste primitives.

---

## Hard constraints (don't break these)

- **Stack:** React 18 + Vite. _No_ Next.js, _no_ migration.
- **Charts:** Chart.js, D3, Plotly, recharts, react-force-graph all stay.
  Redesign their _containers_ (`<ChartCard>`) and pass them token-derived
  colors via the `--color-*` legacy aliases. Don't replace the engines.
- **Dashboard IA is fixed:** sidebar + 6 sections (Overview, Activity,
  Knowledge & Risk, Hotspots, Architecture, Developer Roles).
- **Tokens must be paste-ready CSS custom properties** — `colors_and_type.css`
  is exactly that.
- **Desktop-first.** Mobile degrades; it is not a launch requirement.

---

## How to use this system

1. Drop `colors_and_type.css` into your stylesheet.
2. Use `.ga-*` semantic classes (`ga-h1`, `ga-eyebrow`, `ga-num`, `ga-mono`)
   instead of inventing inline font-sizes.
3. Build cards with `background: var(--bg2)`, `border: 1px solid var(--b)`,
   `border-radius: var(--rl)`. Hover: bump border to `var(--bs)`.
4. One accent per view. Semantic colors signal _data state_, not _UI state_.
5. Animate state changes, not decoration. Particle canvas is the only ambient
   motion.

---

## See also

- **`ui_kits/landing/`** — the hero, particle canvas, scroll-reveal sections,
  terminal window, metrics grid, CTA, footer. Open `index.html` to interact.
- **`ui_kits/dashboard/`** — topbar + sidebar shell with Overview /
  Architecture / Developer Roles content. Switch sections from the sidebar.
- **`preview/`** — small per-token cards that get registered into the
  Design System tab. Useful as reference plates.

If you want to go deeper than this folder, read
`frontend/src/styles.css` (the canonical token source) and
`frontend/src/pages/Home.jsx` (the canonical motion + composition source).
