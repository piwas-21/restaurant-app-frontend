# Frontend Design System

> Centralized design tokens, shared components, and UX patterns for RUMI Restaurant.

---

## 1. Token Architecture

All design tokens live in `src/design-system/tokens/` as CSS variable files. Since S15 T2 (ADR-006) the entrypoint is the active template's `tokens.css` (`src/templates/classic/tokens.css` re-exports this layer; the root layout imports `@active-template/tokens.css` immediately before `globals.css`, preserving the pre-T2 CSS order — see [TEMPLATES.md](TEMPLATES.md)). `globals.css` keeps the legacy-name aliases.

```
design-system/
  tokens/
    colors.css          # Primitives + semantic + status + dark mode + backward-compat
    spacing.css         # 4px grid scale + named aliases
    typography.css      # Type scale + weights + line heights
    shadows.css         # Elevation scale + dark mode overrides
    borders.css         # Border radii + widths
    z-index.css         # Layering scale
    animations.css      # Transitions + keyframes + reduced-motion
    index.css           # Barrel import
  components/
    BaseModal/          # Modal wrapper with focus trap, portal, ARIA
    AlertDialog/        # Confirm/cancel dialog (extends BaseModal)
    FormField/          # Label + input + error wrapper
    StatusBadge/        # Order/payment/reservation status display
    CheckboxField/      # Labelled checkbox (label BESIDE the box, unlike FormField)
    ChannelPicker/      # Order-type channel group, composed from CheckboxField
    Button/             # Primary/secondary/danger/ghost/link variants
    DataTable/          # Sortable table with loading/empty states
    EmptyState/         # Icon + title + description + action
    LoadingSpinner/     # Inline/card/fullPage variants
    Card/               # Content container with optional accent border
    PageLayout/         # Page header + content area
    index.ts            # Barrel export
  utils/
    statusColors.ts     # Status -> CSS variable token mapping
    cn.ts               # Class name merge utility
  hooks/
    useBreakpoint.ts    # Responsive breakpoint detection
```

---

## 2. Color System

> **Implementation status (2026-07-07 — S15 T1 slices 1+2):** the semantic layer + §2.5 backward-compat aliases are **LIVE** in `src/design-system/tokens/colors.css` for brand / surface / link / border / feedback (+ the pre-existing chart/status hues moved verbatim), with `globals.css` legacy names aliasing into it.
> **Slice 2 (text tokens): `--text-primary` / `--text-secondary` / `--text-muted` are now DEFINED** (`#1a1a1a`/`#666`/`#6b7280` light, `#f0f0f0`/`#cdcbcb`/`#9ca3af` dark) after a per-usage audit of all 444 pre-existing references (93 CSS modules + 3 inline styles). Legacy `--text-color`/`--text-secondary-color` now alias into them. Audit outcomes: bare usages previously resolved via inheritance (secondary/muted text silently rendered as body color — now correct); `var(…, hex)` fallbacks previously froze one hex across both themes (dark mode now themes properly); no colored-ancestor contexts existed. `--text-tertiary` (a fourth dangling name) was migrated to `--text-muted`; `--surface-color` (2 server components) fixed to `--surface-card`/`--surface-primary`; `AllergenDisplay`/`MenuItemDetails` tag backgrounds moved off undefined `--background-subtle` to surface tokens so dark-mode text stays readable. ⚠️ Trap for template authors: **aliases substitute per-element** — a subtree override of `--text-primary` does not flow into `--text-color` (or vice versa) unless both are (re)declared on that subtree; see the `.home-overlay-header` block in `globals.css`.
> **Slice 3 (text-token cleanup — #153): DONE.** The ~680 now-dead `var(--text-*, hex)` fallbacks and the `[data-theme='dark']`-only rules that merely restated the same text token were removed mechanically (zero visual delta, proven by a post-hoc verifier).
> **Slice 4 (customer-module hex burndown): DONE.** Every customer-flow `*.module.css` (menu / checkout / reservation / account / auth / common / cart / home / order pages) is now at **zero raw hex** — colours resolve through `var(--*)` into `colors.css`. Mechanics, all zero-delta by construction and checked by **two independent** postcss verifiers that resolve each `(selector, property)` site's computed colour in **both** themes before/after, honouring the `[data-theme='dark']` override cascade (0 mismatches in both — one per-declaration pass, one cascade-effective pass): (1) dead `var(--alias, #hex)` fallbacks on **defined** aliases stripped; (2) live `var(--undef, #hex)` fallbacks on **undefined** vars collapsed to their rendered value; (3) bare hex matching a theme-invariant existing token (e.g. `--status-*`, `--feedback-danger`) substituted with that token, or — when it matched a themed token's dark value inside a dark rule / a light+dark pair — the corresponding semantic token; (4) everything else → a **new theme-invariant primitive** (see §2.1); (5) `[data-theme='dark']` rules left fully redundant after (1)/(3) deleted. `rgba()/rgb()` were left **untouched** (no shadow/overlay token layer yet). `@media (prefers-color-scheme: dark)` blocks (a §5.7 anti-pattern in a handful of pre-existing files) were treated as their own cascade axis — hex inside them was frozen to primitives, never merged into the base rule.
> **Ratchet:** `scripts/check-single-file.mjs` now also warns (non-blocking) on raw hex in any customer-surface `*.module.css` — i.e. all module CSS except the staff/admin surface (`app/admin`, `app/dev-portal`, `components/{admin,cashier,server}`, the staff pages still in `app/styles`), `design-system/` (covered by the sibling rule) and the token source. This holds the customer surface at zero.
> **Screenshot baseline (S15 T1 close-out, 2026-07-10): DONE.** The customer surface is pinned by a committed Playwright screenshot baseline — 7 routes (home, menu, empty cart, checkout review, reservations, login, register) × 2 themes × 2 viewports, full-page, linux-generated inside the pinned Playwright image (`e2e/screenshots/`, config `playwright.screenshots.config.ts`, non-blocking CI workflow `screenshots.yml`). This is the **T2 gate input**: the `classic` template extraction must produce zero visual diff against it. Regenerate only via `npm run test:screenshots:docker:update` (see `e2e/README.md` §Screenshot baseline).
> Still pending: the §2.3 status matrix, the staff/admin module burndown, and the §3–§7 token files (spacing/typography/shadows/borders/z-index/animations).

### 2.1 Primitive Palette
Raw colour values, **never referenced directly by components** — only by semantic
tokens, or (transitionally) frozen verbatim where a raw hex had no semantic token.
The real primitive set now **LIVE** in `colors.css` is the one produced by the
slice-4 burndown (§2 status note): ~160 `--color-<family>-<step>` entries in a
clearly-commented `Primitives (S15 T1 slice 4)` block inside `:root`. Each is
**theme-invariant** — identical in light and dark, with **no override** in the
`html[data-theme='dark']` block — which is exactly why substituting a primitive
for a raw hex is zero-delta at every site (including inside dark rules).

Naming: `--color-<family>-<step>` by Tailwind step where the value matches a
Tailwind colour exactly (e.g. `--color-gray-200: #e5e7eb`, `--color-red-600: #dc2626`),
else by hue+lightness bucket (approximate; `-b`/`-c` suffixes disambiguate distinct
values that fall in the same bucket, e.g. two near-identical dark surfaces).

> **Naming hygiene (slice-4 follow-up): DONE.** The primitives were audited
> against the Tailwind v3 default palette and renamed — a pure rename, zero
> visual delta (proven by a before/after `var()`-chain resolver over every css
> declaration in both themes, plus the committed screenshot baseline). Names are
> now a reliable Tailwind reference: an **unsuffixed** `--color-<family>-<step>`
> in a Tailwind-named family always holds the **exact** Tailwind v3 value
> whenever that value exists among our primitives; `-b`/`-c` suffixes mark
> near-bucket approximations only. Non-Tailwind hues live in their own honest
> namespaces: `--color-material-<family>-<step>` (exact Material Design 2014
> values, e.g. `--color-material-red-400: #ef5350`), `--color-brown-*` (Material
> browns formerly misfiled as `orange-700`/`red-800-c`), `--color-iris-*` /
> `--color-plum-*` (the `#667eea`/`#764ba2` gradient family), `--color-neutral-*`
> (exact Tailwind *neutral* greys formerly filed under `gray`), plus the
> pre-existing `--color-gold-*` and `--color-black`.

```css
/* excerpt — see the full block in src/design-system/tokens/colors.css */
--color-gray-200: #e5e7eb;   --color-red-600: #dc2626;    --color-emerald-500 → --status-confirmed;
--color-gold-500: #f4c430;   --color-iris-400: #667eea;   --color-plum-600: #764ba2;
```

> These are **primitives only** — they carry no semantic meaning. New code should
> reference a semantic token (§2.2); a raw value that recurs enough to deserve
> meaning should graduate into a semantic token whose light/dark pair is defined
> in `colors.css`, not stay a primitive.

### 2.2 Semantic Tokens
What components actually reference:

```css
/* Surface */
--surface-primary          /* Page background */
--surface-secondary        /* Section backgrounds */
--surface-card             /* Card backgrounds */
--surface-overlay          /* Modal backdrop */

/* Text */
--text-primary             /* Main body text */
--text-secondary           /* Secondary/helper text */
--text-muted               /* Disabled/placeholder text */
--text-inverse             /* Text on dark backgrounds */
--text-on-primary          /* Text on brand-colored backgrounds */

/* Brand */
--brand-primary            /* #c00000 - RUMI Red */
--brand-primary-hover      /* Hover state */
--brand-primary-light      /* Subtle backgrounds */
--brand-primary-elevated   /* Brand text on an ELEVATED surface — a translucent wash over
                              --surface-secondary, not the paper. Reach for this whenever
                              the brand is small text on a tinted overlay: the brand is
                              tuned against the paper, and one step off it can cost a full
                              point of contrast. Today's only consumer is the top nav's
                              current-page pill, where --brand-primary measured 3.55:1
                              (classic dark) and 3.89:1 (craft light). It is part of the
                              ADR-007 palette contract, so presets repaint it, and
                              palettes/presets.test.ts asserts it clears AA for every
                              preset in both modes. */

/* Feedback */
--feedback-success / -light / -xlight / -dark
--feedback-danger  / -light / -xlight / -dark
--feedback-warning / -light / -xlight / -dark
--feedback-info    / -light / -xlight / -dark

/* Border */
--border-default / -light / -extra-light

/* Link */
--link-default / -hover
```

### 2.3 Status Tokens
Centralized colors for all status badges across the app:

```css
/* Order Status */
--status-order-pending-bg / -text / -border / -dot
--status-order-confirmed-bg / -text / -border / -dot
--status-order-preparing-bg / -text / -border / -dot
--status-order-ready-bg / -text / -border / -dot
--status-order-intransit-bg / -text / -border / -dot
--status-order-completed-bg / -text / -border / -dot
--status-order-cancelled-bg / -text / -border / -dot

/* Payment Status */
--status-payment-pending-bg / -text / -border
--status-payment-paid-bg / -text / -border
--status-payment-partial-bg / -text / -border
--status-payment-refunded-bg / -text / -border
--status-payment-failed-bg / -text / -border

/* Reservation Status */
--status-reservation-pending-bg / -text / -border
--status-reservation-confirmed-bg / -text / -border
--status-reservation-cancelled-bg / -text / -border
--status-reservation-completed-bg / -text / -border
--status-reservation-noshow-bg / -text / -border

/* Order Type */
--order-type-dinein    /* Blue */
--order-type-takeaway  /* Orange */
--order-type-delivery  /* Purple */
```

### 2.4 Dark Mode
All semantic and status tokens have dark mode overrides using `html[data-theme="dark"]`:

```css
html[data-theme="dark"] {
  --surface-primary: var(--color-gray-900);
  --text-primary: #f0f0f0;
  --brand-primary: #e06666;
  --status-order-pending-bg: rgba(251, 191, 36, 0.2);
  --status-order-pending-text: #fbbf24;
  /* ... */
}
```

### 2.5 Backward Compatibility
Old variable names alias to new tokens (zero-breakage migration):

```css
--primary-color:     var(--brand-primary);
--background-color:  var(--surface-primary);
--text-color:        var(--text-primary);
--success-color:     var(--feedback-success);
--danger-color:      var(--feedback-danger);
/* ... */
```

---

## 3. Spacing Scale

4px base grid:

| Token | Value | Use |
|-------|-------|-----|
| `--space-0` | 0 | Reset |
| `--space-1` | 0.25rem (4px) | Tight gaps |
| `--space-2` | 0.5rem (8px) | Input padding, small gaps |
| `--space-3` | 0.75rem (12px) | Default inline padding |
| `--space-4` | 1rem (16px) | Section spacing, page padding |
| `--space-5` | 1.25rem (20px) | Card padding |
| `--space-6` | 1.5rem (24px) | Section gaps, modal padding |
| `--space-8` | 2rem (32px) | Large section gaps |
| `--space-10` | 2.5rem (40px) | Page section separation |
| `--space-12` | 3rem (48px) | Hero spacing |
| `--space-16` | 4rem (64px) | Major section breaks |

**Named aliases:**
```css
--space-page-x: var(--space-4);
--space-page-y: var(--space-4);
--space-section-gap: var(--space-6);
--space-card-padding: var(--space-5);
--space-input-x: var(--space-3);
--space-input-y: var(--space-2);
--space-modal-padding: var(--space-6);
```

---

## 4. Typography Scale

Major Third ratio (1.250):

| Token | Size | Use |
|-------|------|-----|
| `--text-xs` | 0.75rem (12px) | Badges, captions, timestamps |
| `--text-sm` | 0.875rem (14px) | Secondary text, table cells, form labels |
| `--text-base` | 1rem (16px) | Body text |
| `--text-lg` | 1.125rem (18px) | Section titles |
| `--text-xl` | 1.25rem (20px) | Card titles |
| `--text-2xl` | 1.5rem (24px) | Page titles, modal headers |
| `--text-3xl` | 1.875rem (30px) | Hero text |
| `--text-4xl` | 2.25rem (36px) | Display text |

**Weights:** `--font-normal` (400), `--font-medium` (500), `--font-semibold` (600), `--font-bold` (700)

**Line heights:** `--leading-tight` (1.25), `--leading-snug` (1.375), `--leading-normal` (1.5), `--leading-relaxed` (1.625)

---

## 5. Shadows, Borders, Z-Index

### Shadows
```css
--shadow-xs:    0 1px 2px rgba(0,0,0,0.05)
--shadow-sm:    0 2px 4px rgba(0,0,0,0.05)
--shadow-md:    0 4px 12px rgba(0,0,0,0.1)
--shadow-lg:    0 10px 25px rgba(0,0,0,0.1)
--shadow-xl:    0 20px 25px -5px rgba(0,0,0,0.1)
--shadow-modal: 0 4px 20px rgba(0,0,0,0.3)
--shadow-focus: 0 0 0 3px var(--brand-primary-light)
```

### Border Radii
```css
--radius-sm:   4px     /* Inputs, small cards */
--radius-md:   6px     /* Badges, buttons */
--radius-lg:   8px     /* Cards, modals */
--radius-xl:   12px    /* Large cards */
--radius-2xl:  16px    /* Hero sections */
--radius-full: 9999px  /* Pills, avatars */
```

### Z-Index Layering
```
--z-sticky:          10    /* Sticky table headers */
--z-banner:         100    /* Banners, action bars */
--z-dropdown:       200    /* Dropdowns, popovers */
--z-header:        1000    /* App header */
--z-sidebar:       1100    /* Admin sidebar */
--z-toast:         1200    /* Notification toasts */
--z-modal-backdrop: 1300   /* Modal overlay */
--z-modal:         1400    /* Modal content */
--z-modal-urgent:  1500    /* Nested/critical modals */
--z-tooltip:       1600    /* Tooltips */
```

---

## 6. Component API Reference

### BaseModal
```tsx
interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  titleIcon?: React.ReactNode;
  variant?: 'default' | 'danger' | 'success' | 'info';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';   // 400/500/600/900/100%
  footer?: React.ReactNode;
  closeOnBackdropClick?: boolean;  // default: true
  closeOnEscape?: boolean;         // default: true
  showCloseButton?: boolean;       // default: true
  id?: string;
  className?: string;
  children: React.ReactNode;
}
```

Features: `createPortal`, focus trap, Escape key, scroll lock, `aria-modal`, `role="dialog"`, fade+slide animation.

### AlertDialog
```tsx
interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string | React.ReactNode;
  variant?: 'danger' | 'warning' | 'info';
  confirmLabel?: string;
  cancelLabel?: string;
  isConfirming?: boolean;
  confirmationText?: string;  // Type-to-confirm pattern
}
```

### FormField
```tsx
interface FormFieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}
```

### StatusBadge
```tsx
interface StatusBadgeProps {
  status: string;
  type: 'order' | 'payment' | 'reservation';
  size?: 'sm' | 'md';
  className?: string;
}
```

### CheckboxField
Shipped 2026-08-02 (BUGS-IMPROVEMENTS-PLAN E2). `FormField` renders the label ABOVE the input, which
is wrong for a checkbox — so before this, every checkbox in the app was a raw `<input>`.
```tsx
interface CheckboxFieldProps {
  label: string;                 // always required; hide it with srOnlyLabel, never omit it
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  srOnlyLabel?: boolean;         // table cells: the column header labels it on screen
  error?: string;                // message + aria-invalid + aria-describedby
  invalid?: boolean;             // aria-invalid with NO message — for a group-level failure
  description?: string;
  describedBy?: string;          // ids of text OUTSIDE the component (e.g. a group error)
  styles?: Readonly<Record<string, string>>;  // host skin; keys: field control input label srOnly disabled description error
}
```
The input is a direct child of the `<label>`, so the association needs no id — and the click target
is the label rather than the 13px box. The `<label>` wraps the box and the visible text and
**nothing else**: HTML-AAM's label-content rule folds every text node inside it into the accessible
NAME, so a description or error rendered in there is announced as part of the name *and* again as
the description. `describedBy` exists for the same reason — a wrapper `<div>` is `role="generic"`
and is not exposed, so `aria-describedby` has to reach the input.

### ChannelPicker
The order-type channel group, composed from `CheckboxField`. Order comes from `ALL_ORDER_TYPES` and
labels from `orderTypeLabel`, so a new channel reaches every surface that lists channels. **One
consumer today** — the product editor's channel row; the category matrix keeps its `<table>` (three
`<td>`s are what make a column scannable) and consumes `CheckboxField` + `orderTypeLabel` directly.
See ADR-005's 2026-08-02 amendment for why it is admitted with one consumer. It deliberately
does NOT own the selection — a product round-trips a nullable mask with an inherit mode, a category
row round-trips a dirty-tracked list, and folding either in would make the other a special case.
```tsx
interface ChannelPickerProps {
  selected: readonly OrderType[];
  onToggle: (orderType: OrderType) => void;
  disabled?: boolean;
  error?: string;                // rendered once; every box gets aria-invalid
  errorId?: string;
  styles?: Readonly<Record<string, string>>;
  checkboxStyles?: Readonly<Record<string, string>>;
}
```

### Button
```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}
```

### EmptyState
```tsx
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}
```

### LoadingSpinner
```tsx
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  variant?: 'inline' | 'card' | 'fullPage';
}
```

---

## 7. Accessibility (WCAG 2.1 AA)

- `:focus-visible` ring on all interactive elements
- Skip-to-content link in main layout
- `BaseModal`: `aria-modal="true"`, `role="dialog"`, `aria-labelledby`, focus trap
- `StatusBadge`: includes `.sr-only` text (color not sole indicator)
- Touch targets: min 44x44px on mobile
- Color contrast: all text/bg pairs meet 4.5:1 (normal) or 3:1 (large text)

---

## 8. RTL Support (Arabic)

**Status: partial.** `dir` is wired; the sweep to logical properties is in progress (BUGS-IMPROVEMENTS-PLAN E8). What is true today:

- `<html lang>` and `dir` are synced from `i18n.language` by `DocumentLanguage`; the locale set lives in `RTL_LANGUAGES` (`src/lib/textDirection.ts`) — `ar` is the only one of the ten shipped locales that is RTL. **That set is also the revert lever**: drop `ar` from it and the whole app returns to LTR without a rollback.
- New CSS **must** use logical properties — `margin-inline-start`, `padding-inline-end`, `border-inline-start`, `inset-inline-start`/`-end`, `text-align: start | end`. The `physical-CSS ratchet (E8)` check (`scripts/check-physical-css.mjs`) holds the count of remaining physical declarations and only ever lets it fall.
- Directional **icons** mostly do not flip yet. Four `[dir='rtl']` rules exist; **copy `ImageGalleryModal`**, which is the only one showing the FULL coupling rather than a glyph on its own — `.prev`/`.next` on `inset-inline-start`/`-end`, the chevrons mirrored with `[dir='rtl'] … svg { transform: scaleX(-1) }`, *and* `ImageGalleryModal.tsx`'s ArrowLeft/ArrowRight handlers remapped to reading order. Convert any one of those three alone and `ar` gets a "previous" control on the trailing edge pointing at the leading one, driven by the opposite key. The other three are the category-nav chevrons (`CategoryNav.module.css`, `CraftCategoryNav.module.css`) and `ContactIcons.module.css`'s reveal offset. The remaining directional icons and the craft `--craft-tape-clip` polygon are E8 slice 3.
- **A gallery mirrors; a floor plan does not.** Reading order is what flips, so lists, carousels and navigation follow the language. The floor plan is a physical room and must stay put — verified on `demo.sofrapiwas.com` in `ar`.
- **Scroll arithmetic is directional too, and no CSS gate can see it.** A scroller reports `scrollLeft === 0` at its inline START in both directions, growing positive toward the end in LTR and NEGATIVE in RTL (measured in Chromium, not assumed). Reason in `Math.abs(scrollLeft)`, and take the sign for `scrollBy` from `getComputedStyle(el).direction` — `scrollBy` itself is not direction-aware. `useCategoryNavScroll` is the worked example.

### 8.1 What must stay physical

A logical property is byte-identical to its physical twin under `dir="ltr"`, so converting is safe **unless the declaration is coupled to something that has no logical form**.

**`--dir` is the answer for two of the three** (`globals.css`: `+1` under `ltr`, `-1` under `rtl`). `transform: translateX()` and `box-shadow`'s x-offset take a *distance*, so multiplying it by `--dir` lets a coupled pair move together: `translateX(calc(var(--dir) * 100%))` is byte-identical to `translateX(100%)` under `ltr` and flips under `rtl`. `background-position: right …` takes a *keyword*, which no multiplier can express — that one still needs a `[dir='rtl']` rule. `var()` resolves inside `@keyframes` too (substitution happens on the animating element), so an entry animation can be direction-aware without an animation-name swap.

**Verify RTL by switching the app's LANGUAGE, never by editing the `dir` attribute in devtools.** `next dev --turbopack` runs Lightning CSS, which downlevels logical properties and `:dir()` into `:lang()`-keyed rules; `next build` emits them verbatim. So in dev, `inset-inline-start` and friends follow `lang`, not `dir`, and a hand-flipped `dir` mirrors *some* rules and not others. Switching the language sets both attributes together, which is the only way dev agrees with production. This bit twice on this slice — once making a fix look verified when nothing had moved.

**`--dir` keys off the `dir` ATTRIBUTE, and that leaves one known gap.** An element inside `dir="auto"` that resolves to Arabic computes `direction: rtl` — logical properties mirror — while `[dir='rtl']` does not match and `--dir` stays `+1`: a half-conversion. `:dir()` matches the resolved direction and is the correct fix, but it was tried and reverted here, because the downleveling above makes it behave differently in dev and prod — and worse than the attribute rules in dev. Nothing uses `dir="auto"` today, so the gap is unreachable; close it in the slice that puts `dir="auto"` on product-authored text, and verify that one against `next build`.

| Coupling | Why it breaks | Do instead |
| --- | --- | --- |
| `transform: translateX(…)` | `transform` is never logical. Mirror the inset alone and a drawer parked off-screen with `translateX(100%)` lands **on** screen in `ar`. **Grep `animation:` as well as `transform:`** — the translate is often in an `@keyframes` block further down the file, so the coupled rule contains no `transform` of its own. That indirection is what hid `MyReservations`'s `.errorAlert` from a rule-local read: an `animation:` line alone, with the `translateX(100%)` 15 lines away. (Both toast keyframes are now `slideInFromTrailingEdge` — named for reading order, since under `rtl` the same declaration enters from the physical left.) | `translateX(calc(var(--dir) * …))`, converting the inset in the same edit. |
| `box-shadow` with a non-zero x-offset | Also never logical, and **invisible to the ratchet**, which counts properties rather than offsets. A drawer shadow cast into the page falls *under* the drawer in `ar`. | `box-shadow: calc(var(--dir) * -4px) 0 12px …` |
| A **transitioned** property that reads `--dir` | `dir` flips *after first paint* (`layout.tsx` SSRs `dir="ltr"`; `DocumentLanguage` corrects it in a mount effect), so a `--dir` change is itself a transitionable change. The admin sidebar's closed `transform` animated the whole way across: measured at 390px, **37 of 74 frames** had part of a drawer nobody opened inside the viewport and 6 had all of it, on every admin load in `ar` **at ≤768px**, where the sidebar is off-canvas. (At ≥769px it is `position: relative` with `transform: none`, so nothing reads `--dir` and nothing sweeps.) | Make sure the element cannot be seen while it flips — `visibility: hidden` on the closed state (`AdminPage.module.css`), or `display: none` as the header drawers already do. |
| A directional **glyph** on a control that moved | The arrow tracks the drawer's *direction of travel*, so mirroring the drawer inverts it. The admin toggle's `ChevronRight`/`ChevronLeft` became backwards in `ar` the moment the sidebar changed sides. | If the glyph must agree with a box positioned from `--dir`, drive it from `--dir` too: `transform: scaleX(var(--dir))`, so the two cannot drift (`Header.module.css`'s `.adminSidebarToggleFloating svg`). For a standalone glyph with no `--dir` partner, `[dir='rtl'] .x svg { transform: scaleX(-1) }` is fine — that is the `ImageGalleryModal`/`CategoryNav` shape. |
| `background-position: right …` | Has no logical form, and is a keyword, so `--dir` cannot express it. A gutter that clears a chevron must mirror **with** the chevron, or text runs under it. | `padding-inline-end` plus a `[dir='rtl'] .x { background-position: left … }` rule — `AdminOrdersPage.module.css`'s sort dropdown is the worked example. |
| A **vendor's own** injected positioning | A `:global()` override cannot win a coupling the library re-asserts, and the vendor's rules are on hash-named classes (`.go2989568495 { right: 20px }`), so grepping the document for the vendor's name finds only *your* rules and makes its positioning look absent. | Flip the vendor's own switch in the same change — the `rtl` prop for react-big-calendar is the worked example. **And check what else your selector matches**: notistack's stayed physical because one unqualified `.notistack-SnackbarContainer` rule serves two anchors, so converting it clipped the `top-center` cart toast 151px off screen in `ar` while fixing the `bottom-right` ones. Scope per-anchor first. |
| Centring (`left: 50%` + `translateX(-50%)`, or a negative half-width margin) | Centring has no handedness — it is already correct in both directions. | Leave physical; it is not debt. |

**A drawer is the worked example** — `app/styles/Header.module.css` and `templates/craft/chrome/CraftHeader.module.css` (trailing edge) and `app/styles/AdminPage.module.css` (leading edge): inset, border, shadow and transform move in one edit — whichever of the four a given drawer actually has. Only the classic header drawer has all four; craft casts no shadow, and the admin sidebar has no border. Two things it taught that the deferral comments had wrong. **The predicted defect was not the real one for the header drawers**: both are `display: none` when closed, so their parked transform never painted and no closed drawer was ever visible — what was actually broken is that in `ar` the drawer opened on the *opposite side of the screen from its own button* (measured at 390px: hamburger x=16..60, drawer x=110..390). **The admin sidebar is the opposite case**: it is never `display: none`, parked by transform alone, so for it the predicted defect was real — and it is the one that needed the `visibility` row above.

Three more the codemod cannot see, so check them by hand:

- **A `transition` / `@keyframes` naming a physical property must be renamed WITH the declaration.** This is the one coupling that is `ar`-only *and* silent — the LTR check passes, which is what makes it dangerous. Measured in Chromium on `SoundSelector`'s toggle knob (travels `2px → 26px`): with `inset-inline-start` authored and `transition: left` left behind, the knob still animates under `dir="ltr"` — logical insets resolve to physical at computed-value time, so `left` is still the property changing — but under `dir="rtl"` the author's inset maps to `right`, `left` never changes, and the knob **teleports** (`document.getAnimations().length` drops from 3 to 1). Name both logically and it animates correctly in both directions. **A knob that travels on a `transform` should be moved onto its own inset instead, not signed with `--dir`** — all three toggles in the repo now do this (`SoundSelector`, `OrderTypeManager`, `CookieSettingsModal`). Signing the translate *looks* equivalent and is not: the transition applies to the travel, so a language switch sweeps the knob across its track. Measured — `translateX(calc(var(--dir) * 24px))` under that transition produced a running `transform` animation stepping `24 → 23.4 → … → 7.5`. With an inset the knob still moves on the flip (it has to — a toggle mirrors), but it moves *instantly*: the flip takes `left` from a length to `auto`, which is not an interpolable pair, so no transition runs.
- **Asymmetric 4-value shorthands** (`padding: a b c d` where `b ≠ d`) are directional in slots 2 and 4. Split to `padding-block` + `padding-inline: <start> <end>`.
- **A reset must use the same name as what it resets.** Mixing `left:` in a base rule with `inset-inline-start:` in an override makes the winner depend on source order rather than on specificity. **This includes rules that ship in `node_modules`**, which nothing in `src/` greps for — a `:global()` override of a vendor stylesheet must convert **in the same change** as the vendor's own RTL switch, never before it. `ReservationCalendar.module.css` is the worked example: rbc ships `.rbc-time-header-content { border-left: 1px solid #ddd }` and, under `.rbc-rtl`, `{ border-left-width: 0; border-right: 1px solid #ddd }`. Convert the override alone and `ar` gets two borders; pass `rtl` alone and the `!important` left border beats rbc's zero and `ar` gets two borders the other way. Together they land on one edge, themed — verified in both directions **and both themes**, which matters because `--border-color`'s light value *is* `#ddd`, so a light-mode colour check cannot distinguish our override from rbc's own rule.
- **`!important` hides a declaration from a naive codemod.** `text-align: right !important` does not match a pattern anchored on a trailing `;` right after the value. The ratchet does count these, so a half-converted rule shows up as a count that will not fall — but check by hand.

Anything deliberately physical carries a comment saying so and stays in the ratchet's count — the ratchet measures syntax, not defects.

---

## 9. Migration Strategy

1. **Phase 1** (Sprint 4): Create token files, import in `globals.css` with backward-compat aliases. Zero visual change.
2. **Phase 2** (Sprint 5): Build shared components. Migrate cashier module first (highest hardcoded color density).
3. **Phase 3** (Sprint 6-7): Migrate admin, customer pages. Replace all inline hex colors.
4. **Phase 4** (Sprint 8): Remove backward-compat aliases. RTL + accessibility. Final cleanup.

Each phase is additive and non-breaking.
