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

### 2.1 Primitive Palette
Raw color scales, never used directly in components:

```css
/* Red (RUMI Brand) */
--color-red-50: #fff5f5;   --color-red-100: #fee2e2;  --color-red-200: #fecaca;
--color-red-300: #fca5a5;  --color-red-400: #f87171;  --color-red-500: #ef4444;
--color-red-600: #dc3545;  --color-red-700: #c00000;  /* RUMI Red */
--color-red-800: #991b1b;  --color-red-900: #7f1d1d;

/* Gray */
--color-gray-50: #f9fafb;  --color-gray-100: #f3f4f6; --color-gray-200: #e5e7eb;
--color-gray-300: #d1d5db;  --color-gray-400: #9ca3af; --color-gray-500: #6b7280;
--color-gray-600: #4b5563;  --color-gray-700: #374151; --color-gray-800: #1f2937;
--color-gray-900: #111827;

/* + Amber, Green, Blue, Purple, Orange, Cyan scales */
```

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
