# Frontend Design System

> Centralized design tokens, shared components, and UX patterns for RUMI Restaurant.

---

## 1. Token Architecture

All design tokens live in `src/design-system/tokens/` as CSS variable files, imported via `globals.css`.

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
> **Slice 4 (customer-module hex burndown): DONE.** Every customer-flow `*.module.css` (menu / checkout / reservation / account / auth / common / cart / home / order pages) is now at **zero raw hex** — colours resolve through `var(--*)` into `colors.css`. Mechanics, all zero-delta by construction and checked by a postcss verifier that resolves each `(selector, property)` site's computed colour in **both** themes before/after (8178 sites, 0 mismatches): (1) dead `var(--alias, #hex)` fallbacks on **defined** aliases stripped; (2) live `var(--undef, #hex)` fallbacks on **undefined** vars collapsed to their rendered value; (3) bare hex matching a theme-invariant existing token (e.g. `--status-*`, `--feedback-danger`) substituted with that token, or — when it matched a themed token's dark value inside a dark rule / a light+dark pair — the corresponding semantic token; (4) everything else → a **new theme-invariant primitive** (see §2.1); (5) `[data-theme='dark']` rules left fully redundant after (1)/(3) deleted. `rgba()/rgb()` were left **untouched** (no shadow/overlay token layer yet). `@media (prefers-color-scheme: dark)` blocks (a §5.7 anti-pattern in a handful of pre-existing files) were treated as their own cascade axis — hex inside them was frozen to primitives, never merged into the base rule.
> **Ratchet:** `scripts/check-single-file.mjs` now also warns (non-blocking) on raw hex in any customer-surface `*.module.css` — i.e. all module CSS except the staff/admin surface (`app/admin`, `app/dev-portal`, `components/{admin,cashier,server}`, the staff pages still in `app/styles`), `design-system/` (covered by the sibling rule) and the token source. This holds the customer surface at zero.
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
values that fall in the same bucket, e.g. two near-identical dark surfaces). Non-Tailwind
families that recur get sensible names — e.g. `--color-gold-500: #f4c430`, the
indigo/violet gradient family (`#667eea`/`#764ba2`/`#5568d3`), `--color-black`,
`--color-white`.

```css
/* excerpt — see the full block in src/design-system/tokens/colors.css */
--color-gray-200: #e5e7eb;   --color-red-600: #dc2626;    --color-emerald-500 → --status-confirmed;
--color-gold-500: #f4c430;   --color-blue-400: #667eea;   --color-violet-600: #764ba2;
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

- `document.documentElement.dir = 'rtl'` set via language detection
- CSS uses logical properties: `margin-inline-start` (not `margin-left`)
- Directional icons flip via `[dir="rtl"] svg { transform: scaleX(-1) }`
- RTL languages: `['ar', 'he', 'fa']`

---

## 9. Migration Strategy

1. **Phase 1** (Sprint 4): Create token files, import in `globals.css` with backward-compat aliases. Zero visual change.
2. **Phase 2** (Sprint 5): Build shared components. Migrate cashier module first (highest hardcoded color density).
3. **Phase 3** (Sprint 6-7): Migrate admin, customer pages. Replace all inline hex colors.
4. **Phase 4** (Sprint 8): Remove backward-compat aliases. RTL + accessibility. Final cleanup.

Each phase is additive and non-breaking.
