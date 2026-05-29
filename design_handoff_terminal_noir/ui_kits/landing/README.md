# Landing page — UI kit

A faithful, interactive recreation of the git·analyzer landing page.

**Entry:** `index.html` — loads React 18 + Babel and mounts the
components in order. Open it to see the full page top-to-bottom.

## Components

| File              | What it is                                              |
| ----------------- | ------------------------------------------------------- |
| `Canvases.jsx`    | `<ParticleCanvas>` (hero) and `<PCACanvas>` (roles map) |
| `Primitives.jsx`  | `Ico.*` icon set + `useReveal()` scroll-fade hook        |
| `HeroSection.jsx` | `<NavBar>`, `<Hero>`, `<StatsStrip>`                    |
| `Features.jsx`    | `<Features>` (6 lenses), `<Roles>` (7-role grid + PCA)  |
| `Sections.jsx`    | `<HowItWorks>`, `<Metrics>`, `<CTASection>`, `<Footer>` |
| `App.jsx`         | Orchestrates the scroll order, theme toggle, demo submit |
| `landing.css`     | All styles — based on the original `Home.css`           |

## Interactions wired up

- Theme toggle (sun / moon in the nav) — flips `data-theme` on the html.
- Particle canvas — drifts on a slow random walk, idle motion.
- Smooth-scroll nav anchors.
- Hover lift on feature cards.
- Scroll-reveal fade-up (`.hp-reveal` → adds `.in` when entering viewport).
- Suggestion pills pre-fill the input.
- "Analyze →" shows a transient toast (no real backend).

## What's intentionally not here

- Real OAuth / private-repo picker (the codebase has it; we stub it).
- Real backend polling progress phases (replaced with a toast).
- Mobile breakpoints (desktop-first).

## Reusing pieces

Most components accept simple props and can be lifted into other mocks.
`<ParticleCanvas>` and `<PCACanvas>` are self-contained and resize-aware —
drop them into any container.
