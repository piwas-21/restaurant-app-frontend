# ADR-001 — App Router + Context API for state

**Status:** Accepted
**Date:** 2026-04-27
**Author:** mahmutkaya
**References:**
- [next.config.ts](../../next.config.ts)
- `src/contexts/` — `AuthContext`, `SessionContext`, `CartContext`, `TableContext`, `CheckoutContext`, `ThemeContext`

---

## Context

RUMI Frontend started on Next.js 13 App Router and stuck with it through Next 14 and Next 15. State requirements are **session-scoped** (auth, cart, theme, current table) and **modest in volume** — there's no normalised entity store, no offline cache, no real-time-collab buffer. Three forces shaped the choice:

1. **Most state is naturally request-scoped or session-scoped.** Auth lives in a JWT cookie + a `user` object; cart lives in localStorage + an in-memory mirror; theme is a CSS-attribute toggle.
2. **Server Components do most of the heavy lifting.** Page data comes from server-side fetches that aren't client state at all.
3. **Adding a state library has ergonomic + bundle costs.** Redux/Zustand/Jotai all add boilerplate and runtime weight that pays off when you have many cross-cutting reads/writes — RUMI doesn't.

## Decision

**Use Next.js App Router as the routing primitive and React Context API for the small set of cross-page client state.**

Active contexts:

| Context | Scope | Persistence |
|---|---|---|
| `AuthContext` | logged-in user, role, JWT | HttpOnly cookie + memory |
| `SessionContext` | session metadata (expiry, refresh state) | memory + cookie |
| `CartContext` | line items, totals, customisations | localStorage |
| `TableContext` | current dine-in table (from QR code) | sessionStorage |
| `CheckoutContext` | order-type, address, customer info collected during checkout flow | memory (cleared on order placement) |
| `ThemeContext` | light/dark/system preference | localStorage + `html[data-theme]` |

Each context lives in `src/contexts/<Name>Context.tsx`, exports `<Name>Provider` and `use<Name>()`. Providers compose at the root layout.

## Consequences

### Positive
- **Zero state-library dependency** — bundle stays tight.
- **Familiar primitives** — anyone who knows React knows Context. Onboarding cost = zero.
- **Server Components for data fetching** — most "state" is just an `await fetch()` on the server, no client-state machine needed.
- **Each context is independent** — `CartContext` rerenders cart consumers without touching `AuthContext` consumers.

### Negative
- **No devtools** comparable to Redux DevTools for time-travel debugging.
- **Re-render hazards** — naive consumers of a Context with a mutable object value re-render on any field change. Mitigated by splitting state across multiple Contexts (which we do) and `useMemo`-ing provider values.
- **Cross-context dependencies are awkward** — e.g. `CheckoutContext` reading `CartContext.total` requires hook composition. Acceptable today; would be painful with a dozen contexts.
- **Doesn't scale to entity stores.** When/if RUMI needs a normalised cache (e.g. shared product catalog with mutations from multiple components), a real store will help. Not yet.

### Mitigation for the negatives
- Document the re-render hazard in the design system doc.
- If a context grows to >5 fields with independent consumers, split it before reaching for a library.
- Re-evaluate when the order-flow redesign (see [BUGS-IMPROVEMENTS-PLAN](../../docs/plans/BUGS-IMPROVEMENTS-PLAN.md) Track C) ships — it introduces `OrderTypeContext` and may surface scaling pain.

## Alternatives considered

### Alternative A: Redux Toolkit
Industry standard, great devtools, slice-based modularity. Rejected because the boilerplate (`createSlice`, `configureStore`, `useSelector`/`useDispatch`) for our state volume is overkill, and we'd ship ~13 kB gz of runtime for a problem the platform already solves.

### Alternative B: Zustand
Smaller (~1 kB gz), no boilerplate. Strong choice for greenfield. Rejected because Context covers our use cases without adding a dependency, and migration cost from Context → Zustand is ~1 day if/when needed (the hooks already exist; we'd just swap the implementation).

### Alternative C: Jotai / Recoil (atom-based)
Excellent for derived state graphs. Overkill for RUMI's mostly-flat state. Re-evaluate if a feature needs heavy derived/reactive computation.
