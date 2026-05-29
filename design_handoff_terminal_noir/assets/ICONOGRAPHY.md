# Iconography

The git·analyzer codebase ships its own SVG icons inline (no icon font, no
sprite, no PNG icons). They follow the **Feather / Lucide** family —
24×24 viewBox, `2px` stroke, `stroke-linecap="round"`, `currentColor`.

## Rules

| Rule                  | Value                                                                |
| --------------------- | -------------------------------------------------------------------- |
| viewBox               | `0 0 24 24`                                                          |
| fill                  | `none` (always — fills are reserved for the GitHub mark)             |
| stroke                | `currentColor` (always — picks up text color)                        |
| stroke-width          | `2` (default), `2.5` (download icon only), `3` (checkmark stroke)    |
| stroke-linecap        | `round`                                                              |
| Sizing                | 12–14px in controls / nav · 18–22px in feature cards · 36px in icon tiles |

## Reference set

These are the icons the dashboard ships with. Reuse the snippets verbatim
when you build new screens — don't draw your own.

### Navigation

```jsx
// Overview (grid of 4)
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
  <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
</svg>

// Activity (pulse line)
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
</svg>

// Knowledge & Risk (globe meridians)
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
  <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
  <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
</svg>

// Hotspots (lightning bolt)
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
</svg>

// Architecture (3 nodes + 2 edges)
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
</svg>

// Developer Roles (people)
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
</svg>
```

### Action / state

```jsx
// Back arrow (sidebar return)
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
  <polyline points="15 18 9 12 15 6"/>
</svg>

// Refresh (re-analyze)
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
</svg>

// Download (PDF report) — stroke-width="2.5"
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
</svg>

// Sun / Moon (theme toggle)
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
  <circle cx="12" cy="12" r="5"/>
  <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
</svg>
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
</svg>

// Calendar (timeline selector)
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
  <rect x="3" y="4" width="18" height="18" rx="2"/>
  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
  <line x1="3" y1="10" x2="21" y2="10"/>
</svg>
```

### Brand mark

The **GitHub octocat** is the one filled SVG. Use the official path —
do not redraw.

```jsx
<svg viewBox="0 0 24 24" fill="currentColor">
  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504..."/>
</svg>
```

## When you need an icon that isn't in this set

Use **Lucide** via CDN, which matches the existing set 1:1:

```html
<script src="https://unpkg.com/lucide@latest"></script>
<i data-lucide="git-branch"></i>
<script>lucide.createIcons();</script>
```

Or grab a single Lucide SVG from <https://lucide.dev> and paste it inline.
Match the existing stroke / cap settings (`stroke-width="2"`,
`stroke-linecap="round"`).

## Forbidden

- Emoji in UI (the codebase actively suppresses them via CSS).
- Filled icons other than the GitHub mark.
- Icon fonts (Font Awesome, Material Icons, etc.).
- Hand-drawn / sketch-style icon sets — the brand is precise, not playful.
- Colored / multi-stop icons. Single-color, single-stroke only.

## Wordmark

The product wordmark is set in Satoshi 700 with a blue middle dot:

```
git<span style="color: var(--ac)">·</span>analyzer
```

font-size: 15px in nav, 14px in topbar, 13px in footer.
Letter-spacing: `-0.01em`.
