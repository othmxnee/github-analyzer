# INTEGRATION.md — wiring Terminal Noir into `frontend/`

Target stack: **React 18 + Vite** (no migration). Existing files of interest:
- `frontend/src/styles.css` — current token + global styles
- `frontend/src/pages/Home.jsx` + `src/styles/Home.css` — landing page
- `frontend/src/pages/Dashboard.jsx` — the 6-section dashboard
- `frontend/src/components/Charts/*` — Chart.js / D3 / Plotly / recharts / react-force-graph

Work top-to-bottom. Each step is independently shippable.

---

## Step 1 — Reconcile design tokens (`src/styles.css`)

Your `styles.css` already defines `:root` tokens with matching names. Replace
its token block with the one in **`colors_and_type.css`** (this bundle). It is
a superset — it keeps your existing `--color-*` legacy aliases (the charts read
them), so nothing breaks.

Specifically:
1. Copy the `:root { … }` and `:root[data-theme='light'] { … }` blocks from
   `colors_and_type.css` over your current ones.
2. Keep the `@import` font lines at the very top of the file.
3. Verify the legacy aliases survive (charts depend on them):
   `--color-background-primary`, `--color-text-primary`, `--color-accent`,
   `--color-border-tertiary`, `--color-danger`, etc. They're already in the
   bundle, mapped to the new tokens.
4. Optionally adopt the `.ga-*` text utility classes (bottom of the file) for
   new markup; existing markup can keep its current classes.

**Acceptance:** the app looks the same or better; no console errors; light-mode
toggle still works via `data-theme` on `<html>`.

---

## Step 2 — Add the motion hooks (the important part)

Create `frontend/src/hooks/useMotion.js` (or `.jsx`) with three helpers,
ported from `ui_kits/landing/Primitives.jsx` and
`ui_kits/dashboard/Primitives.jsx`:

- `useReveal()` — JS-driven scroll fade-up for `.reveal` elements.
- `useEntrance(selector, stagger, delay)` — staggered hero entrance.
- `useCount(target, dur)` / `<CountUp>` — animated number counter.

### Non-negotiable rule: animations must never gate visibility

Some embed/preview/SSR-hydration contexts suspend CSS animations **and**
`requestAnimationFrame` while reporting the page as "visible". If you animate
by starting at `opacity:0` and relying on a transition/rAF to bring content
back, it can get stuck invisible.

**Pattern (already implemented in the bundle — copy it):**
1. Content is **visible by default**.
2. Probe whether rAF actually fires (`requestAnimationFrame` + a ~280ms
   `setTimeout`). Only **hide-then-animate** if motion is confirmed live.
3. Counters **snap to their final value** via `setTimeout` if rAF never fires.
4. A safety `setTimeout` force-reveals everything after ~5s no matter what.

Reference implementations:
- `ui_kits/landing/Primitives.jsx` → `useReveal`, `useEntrance`, `CountUp`, `useInView`
- `ui_kits/dashboard/Primitives.jsx` → `useCount` (with the snap fallback)
- `ui_kits/dashboard/index.html` → the inline "Motion safety net" script that
  forces chart final-states; port its logic into a React effect that re-runs on
  section change.

---

## Step 3 — Landing page (`Home.jsx`)

1. Port the **mouse-reactive particle canvas** from
   `ui_kits/landing/Canvases.jsx` (`ParticleCanvas`) into a component behind the
   hero. It's self-contained and resize-aware. Drives itself with rAF.
2. Apply `useEntrance('.hero-badge, .hero-h1, .hero-sub, .hero-island')` for the
   staggered hero load-in.
3. Apply `useReveal()` and add `className="reveal"` to each scroll section.
4. Optional flourishes from the bundle: the **repo ticker** marquee
   (`RepoTicker`), the **count-up stats strip**, and the **typing terminal**
   (`TypewriterTerminal` in `ui_kits/landing/Sections.jsx`).
5. Headline accent: use the **glow-pulse** (`text-shadow` keyframes), NOT a
   `background-clip:text` shimmer — clip-text can render invisible in capture
   contexts.

CSS reference: `ui_kits/landing/landing.css` (mirrors your `Home.css`).

---

## Step 4 — Dashboard (`Dashboard.jsx` + `components/Charts/`)

The hard constraint: **keep the existing chart engines.** Restyle the
*containers*, not the engines.

1. **Card container** — wrap each chart in a styled shell (see `CardShell` in
   `ui_kits/dashboard/Layout.jsx`): `background: var(--bg2)`, `1px solid var(--b)`,
   `border-radius: 12px`, no shadow, border → `--bs` on hover, a header row with
   an accent icon tile + mono meta. Your existing `<Bar>`, `<Line>`, D3, Plotly,
   force-graph instances render **unchanged** inside it.
2. **KPI tiles** — use `<Counter value={…} />` (Step 2) so numbers count up and
   snap-to-final in throttled contexts. Pattern in `ui_kits/dashboard/Overview.jsx`.
3. **Mount animation** — let cards fade-up/stagger on section switch
   (`key={activeSection}` on the main content remounts them). Apply the motion
   safety net so nothing sits empty.
4. **Sidebar** — active item: `--ac-d` background + 2px `--ac` left border;
   hover: `--surf`. See `ui_kits/dashboard/Layout.jsx` → `Sidebar`.
5. **Health gauge** — the SVG arc gauge with band colors (red <40, amber <70,
   green ≥70). See `Overview.jsx`.
6. **Charts: pass token-derived colors** into the engines via the `--color-*`
   aliases or `getComputedStyle(root).getPropertyValue('--ac')` so they track
   the theme. Don't hard-code hexes inside chart options.

Do **not** touch the 6-section IA or the polling logic.

---

## Step 5 — Icons

No icon font. Icons are inline SVG, **Feather / Lucide family**: 24×24,
`stroke-width="2"`, `stroke-linecap="round"`, `currentColor`, never filled
(except the GitHub mark). Full copy-paste set + rules in
`assets/ICONOGRAPHY.md`. If you need one not in the set, pull it from Lucide.

---

## Design tokens (quick reference)

| Token group | Values |
| --- | --- |
| Backgrounds | `--bg #07090F` · `--bg2 #0D1018` · `--bg3 #111520` |
| Text | `--t #EEEEF3` · `--t2 #9BA8C8` · `--t3 #5A6380` |
| Accent | `--ac #3B6EEA` (one per screen) · dim `--ac-d` · ring `--ac-b` |
| Semantic | green `#00C896` · amber `#F59E0B` · red `#EF4444` (data state only) |
| Borders | `--b` 8% white · `--bs` 15% white (hover) |
| Radii | `8px` controls · `12px` cards · `16px` island · `999px` pills |
| Fonts | Satoshi (UI) · JetBrains Mono (numbers/code) |
| Motion | 150–300ms state · 500–650ms reveal · ease `cubic-bezier(.16,1,.3,1)` |

Full set with plain-English comments: `colors_and_type.css`.

---

## Acceptance checklist

- [ ] Tokens reconciled; light/dark toggle intact; charts still colored correctly.
- [ ] Hero: particles drift + react to cursor; headline/island enter staggered;
      nothing ever renders invisible.
- [ ] Dashboard: every section's cards, charts, and KPI numbers are visible on
      first paint AND animate in a real tab. KPI tiles never stick at 0.
- [ ] No console errors. No Next.js. Chart engines unchanged. 6-section IA intact.
- [ ] Icons are stroke-only Lucide/Feather; no emoji.
