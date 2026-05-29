---
name: git-analyzer-design
description: Use this skill to generate well-branded interfaces and assets for git-analyzer (an engineering-intelligence platform that turns any GitHub repo into a living dashboard), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc.), copy
assets out and create static HTML files for the user to view. If working on
production code, you can copy assets and read the rules here to become an expert
in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they
want to build or design, ask some questions, and act as an expert designer who
outputs HTML artifacts _or_ production code, depending on the need.

## Quick map

| File                    | Use it for                                                    |
| ----------------------- | ------------------------------------------------------------- |
| `README.md`             | Product context, content + visual foundations, iconography     |
| `colors_and_type.css`   | Paste-ready design tokens (all colors, type, spacing, motion)  |
| `assets/`               | Wordmark SVGs + `ICONOGRAPHY.md` (icon rules + copy-paste set)  |
| `preview/`              | Per-token reference cards (colors, type, spacing, components)   |
| `ui_kits/landing/`      | Interactive landing-page recreation (hero, particles, sections) |
| `ui_kits/dashboard/`    | Interactive dashboard recreation (6 sections, charts, KPIs)     |

## The five rules that make it look right

1. **Dark-first.** Canvas is near-black blue (`--bg #07090F`); cards are `--bg2`,
   inputs `--bg3`. Light mode exists but is secondary.
2. **One accent per screen** — signal blue `--ac #3B6EEA`. Green/amber/red are
   reserved for *data state* (healthy / warning / risk), not UI chrome.
3. **Two fonts** — Satoshi for everything, JetBrains Mono for numbers, file
   names, code, and terminal output. No serif.
4. **Motion serves comprehension.** The particle canvas is the one ambient
   animation. Otherwise: counters count up, charts draw in, cards firm their
   border on hover. Don't over-animate.
5. **Cards** = `--bg2` + 1px `--b` border + 12px radius + *no shadow*; border
   goes to `--bs` on hover.

## IMPORTANT — animations must never gate visibility

Some preview/embed contexts suspend CSS animations **and**
`requestAnimationFrame` while still reporting the document as "visible". If you
animate by starting at `opacity: 0` and relying on a transition/rAF to bring it
back, content can get stuck invisible there.

**Pattern to follow** (see `ui_kits/landing/Primitives.jsx`): keep content
visible by default; probe whether rAF actually fires; only hide-then-animate
when motion is confirmed live; and add a safety timeout that force-reveals
everything regardless. `CountUp` similarly snaps to its final value if rAF
doesn't fire.

## Reusable components worth lifting

- `ParticleCanvas` / `PCACanvas` (landing) — self-contained, resize-aware.
- `CountUp`, `TimelineChart`, `BarChart`, `RadarChart`, `RoleDoughnut`,
  `ArchitectureGraph` (dashboard) — drop-in chart stand-ins.
- `CardShell`, `Sidebar`, `TopBar` (dashboard) — the app shell.

When building for the real product, remember the hard constraints: React 18 +
Vite (no Next.js), and keep the real chart engines (Chart.js, D3, Plotly,
recharts, react-force-graph) — restyle their *containers*, not the engines.
