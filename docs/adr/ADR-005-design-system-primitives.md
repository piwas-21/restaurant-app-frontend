# ADR-005 — `BaseModal`, `FormField`, `StatusBadge` as mandatory wrappers

**Status:** Accepted
**Date:** 2026-04-27
**Author:** mahmutkaya
**References:**
- `src/components/design-system/BaseModal/`
- `src/components/design-system/FormField/`
- `src/components/design-system/StatusBadge/`
- [DESIGN-SYSTEM.md](../DESIGN-SYSTEM.md)

---

## Context

Three UI patterns appear constantly across the app:

1. **Modals** — confirmation dialogs, customisation forms, image lightboxes, address pickers, etc.
2. **Form fields** — every input is `<label> + <input> + <error message>` with the same spacing, focus ring, error colour, accessibility wiring.
3. **Status badges** — order status pills (pending / preparing / ready / delivered / cancelled) appear in cashier, customer track-orders, admin reports.

Without primitives, each implementation drifts: focus traps go missing, escape-to-close works in some modals and not others, error message styling differs by 2 px between forms, status colours differ between cashier and customer views. We saw this before adoption — three different "modal" implementations and four different "status pill" styles.

## Decision

**The frontend has three mandatory wrapper components. Direct use of underlying primitives (raw `<dialog>`, `<input>` without wrapper, inline `<span class="badge">`) is forbidden in code review.**

| Wrapper | What it owns | Underneath |
|---|---|---|
| `BaseModal` | Backdrop, focus trap, escape-to-close, scroll-lock, dark-mode tokens, ARIA roles | `@headlessui/react` Dialog (or Radix; pick one and stick with it) |
| `FormField` | Label, input slot, error message, required indicator, accessibility wiring (`for`/`id`/`aria-describedby`) | None — composes raw `<input>` into a consistent layout |
| `StatusBadge` | Color mapping per status enum, dark-mode tokens, size variants | None — styled `<span>` |

### Naming rules

- Files for modal components are named `<X>Modal.tsx`, **never** `<X>Dialog.tsx` (filename inconsistency was a real source of confusion before this ADR).
- Form-field components (combinations of FormField + custom input) live in `src/components/design-system/forms/`.
- Status-badge variants for new statuses are added to `StatusBadge` itself, not duplicated.

### Enforcement

- Code review (until Sprint 2 lint check)
- Sprint 2 `scripts/check-quality.mjs` will:
  - Fail on `*Dialog.tsx` filenames (must be `*Modal.tsx`)
  - Warn on `<dialog>` element usage outside `BaseModal.tsx`
  - Warn on `<input>` not wrapped in `FormField` (heuristic — opt-out via `// design-system-exempt: <reason>`)

## Consequences

### Positive
- **Visual consistency** by default — devs don't think about it; they just compose `BaseModal`, `FormField`, `StatusBadge`.
- **Accessibility correctness** — focus-trap, ARIA, and keyboard support live in one place. Fix once, fix everywhere.
- **Dark mode in lock-step** — these primitives reference design tokens; theme changes propagate automatically.
- **Refactor-friendly** — swapping the modal underneath (Radix → HeadlessUI → native `<dialog>`) is a change to one file, not 30.

### Negative
- **Onboarding friction** — new contributors will reach for `<dialog>` or inline `<span class="status">` out of habit. Code review catches it.
- **Some specialised cases need escape hatches** — e.g. a fullscreen image gallery may not fit `BaseModal`'s sizing assumptions. Pattern: extend the primitive (add a `fullScreen` prop) rather than bypass it.
- **Wrappers can become god-components** — `BaseModal` accumulating 15 props is a smell. Mitigated by splitting (`BaseModal` + `FormModal` for confirmation-style + `MediaModal` for image gallery).

### Mitigation for the negatives
- Keep wrapper APIs small. If a wrapper needs >7 props, split.
- Document the "extend, don't bypass" rule in the design system doc.
- New design-system primitives need a sponsoring use case (3+ existing or near-term consumers); don't add prematurely.

## Alternatives considered

### Alternative A: Use a UI kit directly (HeadlessUI / Radix / shadcn-ui)
Pro: less code to maintain. Con: no project-specific opinions baked in (i18n keys for error messages, our specific status enum, our dark-mode token wiring). The wrappers exist *because* we have project-specific opinions — they're a thin layer that bakes those in once.

### Alternative B: No wrappers; conventions-only via doc
"Always use HeadlessUI Dialog with these props." Tried it implicitly before — drift was inevitable. Rejected.

### Alternative C: Component generator (CLI scaffolds new component using the wrappers)
Useful but premature. Once we have 30+ form components, revisit.
