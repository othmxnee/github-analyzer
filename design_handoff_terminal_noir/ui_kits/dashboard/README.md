# Dashboard — UI kit

A faithful, click-thru recreation of the git·analyzer dashboard.

**Entry:** `index.html` — mounts with `pallets/flask` as a stub repo and
opens on the Overview section. Use the sidebar to switch between sections.

## Components

| File                  | What it is                                                       |
| --------------------- | ---------------------------------------------------------------- |
| `Primitives.jsx`      | `DIco.*` icons + `<Counter>` (animated number) + `useCount` hook |
| `Charts.jsx`          | `<TimelineChart>`, `<BarChart>`, `<Heatmap>` — built from scratch with draw-in animations |
| `AdvancedCharts.jsx`  | `<ArchitectureGraph>`, `<PCAScatter>`, `<RadarChart>`, `<RoleDoughnut>` |
| `Layout.jsx`          | `<TopBar>`, `<Sidebar>`, `<SectionHead>`, `<CardShell>`           |
| `Overview.jsx`        | Bento KPI grid + health meter + insights + recommendations       |
| `MiddleSections.jsx`  | `<Activity>`, `<KnowledgeRisk>`, `<Hotspots>` (with Lorenz, heatmap, treemap stub) |
| `Sections.jsx`        | `<Architecture>`, `<DeveloperRoles>` (PCA, radar, role doughnut) |
| `App.jsx`             | Shell — theme toggle, sidebar switching, section transitions     |
| `dashboard.css`       | Token-driven styles, lifted from the codebase                    |

## Sections wired up (all 6)

| Sidebar item       | Status     | Notes                                                |
| ------------------ | ---------- | ---------------------------------------------------- |
| Overview           | full       | Bento grid, animated counters, health gauge, insights / recs |
| Activity           | full       | Timeline, top-devs bar chart, Lorenz curve, heatmap  |
| Knowledge & Risk   | full       | KCI + Risk tables                                     |
| Hotspots           | full       | Bar chart + treemap stub                             |
| Architecture       | full       | Hand-positioned dependency graph + tables            |
| Developer Roles    | full       | Role doughnut + skill radar + PCA scatter            |

## Animations the user asked for

- **Animated number counters** — `<Counter value={3847} />` eases from 0 over 900ms.
- **Charts draw in on mount** — timeline uses `stroke-dashoffset` from total length to 0; bars grow via CSS keyframes; doughnut slices fade in staggered.
- **Hover lift / glow on cards** — `.card:hover` firms the border; architecture nodes gain a radial-gradient glow.
- **Smooth section transitions** — `key={active}` remounts `<main>` so cards re-stagger.
- **Sidebar item active state** — animated `border-left` accent + accent background.

## ⚠️ The charts here are cosmetic stand-ins — keep your real engines

**Do not swap your chart libraries.** Per the hard constraint, Chart.js, D3,
Plotly, recharts, and react-force-graph all stay in production. The charts
drawn in this kit (`Charts.jsx`, `AdvancedCharts.jsx`) are hand-built SVG/canvas
**stand-ins** that exist only so the kit renders standalone and demonstrates the
two things worth lifting:

1. **The container** — `<CardShell>` (icon tile · title · mono meta · hairline
   border · hover-firm). Wrap your existing chart instance in this; don't
   touch the chart engine.
2. **The mount animation** — the draw-in / fade-up / stagger and the
   `<Counter>` easing. Apply these to the *container* (and let the engine
   render normally inside); you don't need to reimplement drawing in the
   engine itself.

In short: **lift the wrapper + motion, keep the chart.** A real `<ChartCard>`
is `<CardShell>` + your unchanged `<Bar data=… />` / D3 / Plotly / force-graph.

## What's stubbed

- Real `react-force-graph` (architecture) → static SVG layout (stand-in).
- Real `Plotly` treemap → a 6-cell grid (stand-in).
- Real `Chart.js` / `recharts` line + bar → SVG draw-in versions (stand-in).
- No backend polling — section data is inlined.
- ⌘K command palette — not built; a follow-up if desired.
- Skeleton loaders — a card exists in `preview/`, but the dashboard doesn't
  gate any data on it (no polling).

## Reusing pieces

`<Counter>`, `<TimelineChart>`, `<BarChart>`, `<RadarChart>`, and
`<RoleDoughnut>` are all standalone — drop them into other mocks.
