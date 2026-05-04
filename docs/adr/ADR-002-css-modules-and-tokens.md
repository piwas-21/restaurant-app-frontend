# ADR-002 — CSS Modules + design tokens (instead of Tailwind)

**Status:** Accepted
**Date:** 2026-04-27
**Author:** mahmutkaya
**References:**
- `src/app/globals.css` — design tokens (CSS variables)
- All `*.module.css` files
- [DESIGN-SYSTEM.md](../DESIGN-SYSTEM.md)

---

## Context

Three competing pressures shaped the styling decision:

1. **Strong design-token discipline.** Every colour, spacing, radius, and typography value should come from a single source of truth so dark mode, theming, and future white-labelling are tractable.
2. **Component scoping.** Class-name collisions across a multi-feature codebase are toxic; we need scoping by default.
3. **Dark mode without `prefers-color-scheme`.** RUMI users sometimes use the app in environments where the OS setting doesn't reflect their preference (e.g. POS terminals on light OS but cashier wants dark UI). We need a manual toggle that overrides the system setting — `data-theme` attribute selectors.

## Decision

**Use CSS Modules with a design-token system in `src/app/globals.css`.** All colours, spacing, radius, and typography scale through CSS custom properties. Dark mode via `html[data-theme="dark"]` selector — never `@media (prefers-color-scheme: dark)`.

### Token convention

In `globals.css`:
```css
:root {
  --color-primary: #d4af37;
  --color-bg: #ffffff;
  --color-text: #111827;
  --space-1: 0.25rem;
  --radius-md: 0.5rem;
  /* ... */
}
html[data-theme="dark"] {
  --color-bg: #0f1419;
  --color-text: #e5e7eb;
  /* primary stays the same; brand identity */
}
```

In `<Component>.module.css`:
```css
.button {
  background: var(--color-primary);
  color: var(--color-text);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
}
```

### Hard rules

- **No hex literals** in module CSS — always `var(--token)`.
- **No inline `style={{}}`** in TSX, except for dynamically computed values (e.g. position from props).
- **No `@media (prefers-color-scheme: dark)`** — dark mode is `html[data-theme="dark"]` only.

## Consequences

### Positive
- **One source of truth for design tokens.** Rebrand = change `globals.css`; the whole app updates.
- **Manual theme toggle** works by mutating `<html data-theme>` — independent of OS preference.
- **Zero runtime overhead** — CSS Modules compile at build time; no styled-components / emotion runtime tax.
- **Scoping by default** — `.button` in `MenuItem.module.css` becomes `MenuItem_button__abc123`; no collision with `.button` in `Cart.module.css`.
- **First-class tooling** — Next.js handles `*.module.css` natively; PostCSS pipelines work; HMR is instant.

### Negative
- **More files** — every component owns a `.module.css` sibling. Some teams find this verbose.
- **Less discoverability** — can't grep for "where is `bg-blue-500` used?" the way you can with Tailwind utility classes.
- **No utility-class ergonomics** — `flex items-center gap-2` becomes 3 lines of CSS. For one-off small layouts this is heavier than utility classes.
- **Dark-mode discipline relies on review** — `@media (prefers-color-scheme: dark)` and inline hex literals will compile fine; a linter / pre-commit check (Sprint 2) is needed to catch them.

### Mitigation for the negatives
- A Sprint-2 `scripts/check-quality.mjs` will grep for `@media (prefers-color-scheme: dark)`, hex literals in `*.tsx`/`*.module.css`, and missing `var(--*)` references.
- For one-off layouts, accept the verbosity — it pays back in scoping and theme-ability.

## Alternatives considered

### Alternative A: Tailwind CSS
Excellent ergonomics for utility-first layouts; strong design-token system via `tailwind.config.ts`. Rejected because (a) we'd lose CSS Module scoping (Tailwind classes are global), (b) dark mode toggle + utility classes need careful `dark:` prefix discipline + a `darkMode: 'class'` config, and (c) at the time RUMI started, the team had stronger CSS Modules expertise.

### Alternative B: styled-components / emotion
Runtime tax (~12 kB gz emotion, ~16 kB gz styled-components), and SSR with App Router has been a stability rough patch in their lifecycles. Rejected for runtime cost + ecosystem friction.

### Alternative C: Vanilla Extract / Panda CSS
Build-time CSS-in-JS; near-zero runtime. Strong choice for new greenfield. Rejected because Next.js-native CSS Modules already meet our needs and switching would mean rewriting every existing module.
