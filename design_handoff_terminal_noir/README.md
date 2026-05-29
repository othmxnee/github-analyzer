# Handoff: git·analyzer Design System → `frontend/`

This bundle applies the **Terminal Noir** design system to your existing
**React 18 + Vite** codebase (`frontend/`). It is meant to be handed to
Claude Code with full repo access.

## About the design files

The files in this bundle are **design references** — HTML/JSX prototypes that
show the intended look, motion, and behavior. They are **not** drop-in
production code. Your job, Claude Code, is to **apply the tokens and patterns
into the existing `frontend/` React app**, reusing its established structure
(`src/styles.css`, `src/pages/`, `src/components/Charts/`) and its existing
chart libraries. Do **not** introduce Next.js, swap the chart engines, or
change the dashboard's information architecture.

## Fidelity

**High-fidelity.** Colors, typography, spacing, radii, and motion are final.
Match them exactly.

---

## What's in this bundle

| File / folder            | Role                                                          |
| ------------------------ | ------------------------------------------------------------- |
| `colors_and_type.css`    | The canonical token set (paste target for `src/styles.css`)    |
| `SKILL.md` / `README.md` | The full design-system guide (foundations, voice, iconography) |
| `assets/`                | Wordmark SVGs + `ICONOGRAPHY.md` (icon rules + the icon set)   |
| `ui_kits/landing/`       | Landing-page reference (hero, particles, motion hooks)         |
| `ui_kits/dashboard/`     | Dashboard reference (shell, charts, KPIs, motion)              |
| `INTEGRATION.md`         | **Start here** — step-by-step wiring into `frontend/`          |

---

## Your codebase already has most of this

Your `frontend/src/styles.css` already implements a "Terminal Noir" token
system with the same variable names (`--bg`, `--ac`, `--t`, etc.). This bundle
is the **refined, documented, plain-English** version of those tokens plus the
motion system. Integration is therefore mostly: **reconcile the tokens, add the
motion hooks, and harden visibility** — not a rewrite.

See **`INTEGRATION.md`** for the exact steps.
