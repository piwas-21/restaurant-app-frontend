# Frontend Sprint Plan

> Extracted from the RUMI system-wide sprint plan. Frontend-specific tasks only.

---

## Refactor Track — Live Status (updated 2026-06-01)

> **Cold-session: read this section first.** The unified cross-repo view lives in the workspace
> `ROADMAP.md` (local-only living doc at the workspace root — not committed; this in-repo section is
> the source of truth for the frontend refactor track). The Sprint 6/7 task tables below are
> historical planning; the **god-file table at the bottom has live LOC + status**.

**God-file decomposition: the top tier is fully cleared.** Recently merged to `develop` (each
reviewer-verified byte-equivalent + Qodana re-baselined):

| Area                                  | PR(s)       | Result                                                                                 |
| ------------------------------------- | ----------- | -------------------------------------------------------------------------------------- |
| `useNotification` hook                | #85         | 507→141 (+ tones util, audio hooks)                                                    |
| `orderService`                        | #87         | 342→35 (split by concern behind a barrel)                                              |
| `types/order.ts`, `types/menu.ts`     | #88 #89 #90 | split behind barrels; `SuggestedSideItem` dedupe                                       |
| `AlertDialog` design-system primitive | #91         | built on `BaseModal`                                                                   |
| `OrderDetailsModal.tsx` (admin)       | #92 #93     | 874→136 (sub-components + actions hook; dialogs→AlertDialog)                           |
| `CustomerDiscountForm.tsx`            | #94 #97     | 600→76 (+ 3 robustness fixes)                                                          |
| `CartContext.tsx`                     | #95 #96     | 487→170 (refund-dialog crash-guard fix in #96)                                         |
| `app/reservations/page.tsx`           | #98         | 449→126 (`useReservationsPage`/`useReservationAvailability` + `utils/reservationForm`) |
| `ProductCustomizationInBundle.tsx`    | #99         | 437→128 (`useProductCustomization` + util + 2 sections)                                |
| `cashier/OrderDetails.tsx`            | #100 #101   | tokenize colours (zero visual change) then 450→114                                     |
| `app/cart/page.tsx`                   | #102        | 437→108 (`useCartPage` + item/summary sub-components)                                  |
| `account/AddressManagement.tsx`       | #103        | 437→88 (`useAddressManagement`/`useAddressForm` + card/modal)                          |

**Remaining god files (next, by size — see live table at bottom):**
`checkout/confirmation/page.tsx` (436, page→hook), `TaxConfigurationManager.tsx` (434),
`TakeOrderModal.tsx` (430), `ProductIngredientsManager.tsx` (370), `app/checkout/review/page.tsx`
(420), `cashier/CashierDiagnostics.tsx` (421), `orders-management/page.tsx` (267), oversized hook
`useTableLayout.ts` (315).

> ⚠️ The `checkout/*` pages and `TakeOrderModal` are **critical, untested order-flow surfaces** —
> prefer lower-blast-radius targets unless explicitly directed, and flag for manual verification.

**Established refactor playbook (used for every PR above):**

1. Branch off `develop`; behaviour-preserving extraction (relocate logic/markup verbatim).
2. Logic → `src/hooks/<area>/use*.ts`; pure transforms → `src/utils/*`; render → sub-components in a `<feature>/` subfolder importing the parent module CSS.
3. **Style-debt files** (inline `style={{}}` / hex, §5.5/§5.6): do a **tokenize-first chore PR** (map to CSS-var tokens, zero visual change) THEN decompose — proven on cashier OrderDetails (#100→#101).
4. Run `tsc --noEmit`, `eslint --max-warnings=0`, `prettier`, `npm run build`; regen the file-length baseline (`bash scripts/check-file-length.sh --regen-baseline`).
5. Have the `code-reviewer` agent verify byte-equivalence vs `HEAD` before pushing.
6. ~~On push, Qodana re-flags relocated code as "new" → run the rebaseline workflow~~ **Qodana retired 2026-07-06** (dead token) — static analysis is now SonarCloud automatic analysis (`piwas-21_restaurant-app-frontend`); no rebaseline step, new-code focus is handled by SonarCloud's new-code period.
7. After merge, check Gemini PR comments. This track's comments have all been **pre-existing/verbatim** nits or behaviour-change suggestions (not regressions) — documented in `ROADMAP.md`, not fixed in the verbatim PR. The one genuine bug found (#99 `excludedIngredients` always `[]`, flows to the backend basket payload) was **spawned as a separate investigation task** (needs backend-contract check).

**Owed before develop→main promotion:** none of the refactored surfaces have automated unit/E2E
coverage — manual smoke verification is owed for each. The now-pure extracted utils
(`reservationForm`, `productCustomization`, `customerDiscountForm`, `orderStatusColor`, address
validators) are strong unit-test candidates for the test-coverage track.

---

## Sprint 1: Critical Fixes -- COMPLETE

| #   | Task                                                                               | Status |
| --- | ---------------------------------------------------------------------------------- | ------ |
| 1.8 | Fix dark mode bug in `orderStatus.module.css` (prefers-color-scheme -> data-theme) | DONE   |
| 1.9 | Create `CLAUDE.md` with development guidelines                                     | DONE   |

---

## Sprint 1.5: CRITICAL Security Fixes (IMMEDIATE)

> From security audit: 3 CRITICAL + 5 HIGH severity findings. See `docs/SECURITY-AUDIT.md`.

### CRITICAL Priority

| #   | Task                                                                                                    | Severity | File(s)                                                                       |
| --- | ------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| FS1 | **Remove hardcoded credentials from `.env`** - delete ADMIN/CASHIER/CUSTOMER lines, rotate all accounts | CRITICAL | `.env`                                                                        |
| FS2 | **Fix session ID generation** - replace `Math.random()` UUID with `crypto.randomUUID()`                 | HIGH     | `services/sessionService.ts`                                                  |
| FS3 | **Run `npm audit fix`** - fix jsPDF (9 vulns), DOMPurify, lodash, handlebars                            | HIGH     | `package.json`                                                                |
| FS4 | **Add file upload validation** - type whitelist + 5MB size limit on client side                         | HIGH     | `components/admin/product-details/ImageGallery.tsx` and all upload components |
| FS5 | **Implement token refresh mutex** - prevent race condition on concurrent 401s                           | HIGH     | `utils/apiClient.ts`                                                          |

### Test Infrastructure Setup

| #   | Task                                                                                         |
| --- | -------------------------------------------------------------------------------------------- |
| FT1 | Enable `collectCoverage: true` in `jest.config.js`                                           |
| FT2 | Create missing `__mocks__/nextRouterMock.js`                                                 |
| FT3 | Install `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` |
| FT4 | Create `test-utils/renderWithProviders.tsx` (wraps Auth + Session + Cart contexts)           |
| FT5 | Create `test-utils/factories.ts` (createMockOrder, createMockProduct, etc.)                  |
| FT6 | Write `authService.test.ts` (10 tests)                                                       |
| FT7 | Write `sessionService.test.ts` (5 tests)                                                     |

### Planned for Backend Collaboration (requires backend changes)

- Move tokens from localStorage to httpOnly cookies (C2) -- backend must set cookies
- Implement CSRF protection (C3) -- backend must generate tokens
- Move verify-email tokens from URL params to POST (H3) -- backend endpoint change

**Acceptance:** No credentials in `.env`, `npm audit` shows 0 critical/high, session IDs use crypto, file uploads validated, 15 new tests pass.

---

## Sprint 4: Design System Foundation

**Goal:** Create token infrastructure with zero visual breakage.

| #    | Task                                                                                          | New Files                              |
| ---- | --------------------------------------------------------------------------------------------- | -------------------------------------- |
| 4.1  | Create `tokens/colors.css` - primitives, semantic, status, dark mode, backward-compat aliases | `design-system/tokens/colors.css`      |
| 4.2  | Create `tokens/spacing.css` - 4px grid scale + named aliases                                  | `design-system/tokens/spacing.css`     |
| 4.3  | Create `tokens/typography.css` - type scale, weights, line heights                            | `design-system/tokens/typography.css`  |
| 4.4  | Create `tokens/shadows.css` - elevation scale + dark mode                                     | `design-system/tokens/shadows.css`     |
| 4.5  | Create `tokens/borders.css` - radii + widths                                                  | `design-system/tokens/borders.css`     |
| 4.6  | Create `tokens/z-index.css` - systematic layering scale                                       | `design-system/tokens/z-index.css`     |
| 4.7  | Create `tokens/animations.css` - transitions + reduced-motion                                 | `design-system/tokens/animations.css`  |
| 4.8  | Create `tokens/index.css` barrel import                                                       | `design-system/tokens/index.css`       |
| 4.9  | Import tokens in `globals.css` (first line)                                                   | (modify `globals.css`)                 |
| 4.10 | Visual regression baseline (12 screenshots: 6 pages x light/dark)                             | --                                     |
| 4.11 | Create `cn()` class merge utility                                                             | `design-system/utils/cn.ts`            |
| 4.12 | Create `statusColors.ts` utility                                                              | `design-system/utils/statusColors.ts`  |
| 4.13 | Create `useBreakpoint` hook                                                                   | `design-system/hooks/useBreakpoint.ts` |
| 4.14 | Complete dark mode overrides (missing warning/info tokens)                                    | (modify `colors.css`)                  |

**Acceptance:** `npm run build` passes, visual regression shows zero differences, dark mode toggle renders all statuses correctly.

---

## Sprint 5: Shared Component Library & Cashier Migration

**Goal:** Build core components. Migrate cashier module as first adopter.

| #    | Task                                                                                 | Details                                                            |
| ---- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 5.1  | Build `BaseModal`                                                                    | Portal, focus trap, Escape, scroll lock, ARIA, animation           |
| 5.2  | Build `AlertDialog`                                                                  | Extends BaseModal: confirm/cancel, danger variant, type-to-confirm |
| 5.3  | Build `FormField`                                                                    | Label + input + error + hint wrapper                               |
| 5.4  | Build `StatusBadge`                                                                  | Uses status tokens, `.sr-only` for accessibility                   |
| 5.5  | Build `Button`                                                                       | 5 variants, 3 sizes, loading state, icons                          |
| 5.6  | Build `LoadingSpinner`                                                               | 3 variants: inline, card, fullPage                                 |
| 5.7  | Build `EmptyState`                                                                   | Icon + title + description + action                                |
| 5.8  | Create barrel export `index.ts`                                                      | All components importable from one path                            |
| 5.9  | Migrate `CashierHeader.tsx` - replace 7 hardcoded hex values                         |                                                                    |
| 5.10 | Migrate `OrderList.tsx` - replace inline status colors with `StatusBadge`            |                                                                    |
| 5.11 | Migrate `OrderDetails.tsx` - replace inline status colors with `StatusBadge`         |                                                                    |
| 5.12 | Migrate `QRScannerDialog.tsx` - replace 13 inline styles, rename to `QRScannerModal` |                                                                    |
| 5.13 | Migrate `CancelOrderDialog` -> `AlertDialog`, rename to `CancelOrderModal`           |                                                                    |
| 5.14 | Migrate `StatusUpdateDialog` -> `BaseModal`, rename to `StatusUpdateModal`           |                                                                    |
| 5.15 | Migrate `PaymentDialog` -> `BaseModal`, rename to `PaymentModal`                     |                                                                    |
| 5.16 | Migrate `RefundDialog` -> `AlertDialog`, rename to `RefundModal`                     |                                                                    |
| 5.17 | Migrate `FocusOrderDialog` -> `AlertDialog`, rename to `FocusOrderModal`             |                                                                    |
| 5.18 | Migrate `ZReportModal` -> `BaseModal`                                                |                                                                    |
| 5.19 | Migrate `CashierDiagnostics.tsx` - replace 10 inline color styles                    |                                                                    |

**Acceptance:** Cashier page fully functional, all modals use BaseModal/AlertDialog, zero hardcoded colors in cashier module, dark mode correct.

---

## Sprint 6: God File Decomposition

**Goal:** Split oversized frontend files into focused modules.

> **Status:** the hook-extraction track (6.6–6.14) shipped earlier (frontend !34–!40); 6.1–6.5
> (`OrderDetailsModal` 874→136) landed in #92/#93; 6.12 (`CustomerDiscountForm` 597→76) in #94.
> The remaining decompositions are tracked in the **Live Status** section at the top and the
> god-file table at the bottom — those are current; the per-task rows below are historical.

| #    | Task                                                    | Current LOC | Target LOC |
| ---- | ------------------------------------------------------- | ----------- | ---------- |
| 6.1  | Extract `OrderHeader.tsx` from `OrderDetailsModal`      | --          | ~100       |
| 6.2  | Extract `OrderItemsList.tsx` from `OrderDetailsModal`   | --          | ~100       |
| 6.3  | Extract `OrderPaymentInfo.tsx` from `OrderDetailsModal` | --          | ~100       |
| 6.4  | Extract `OrderActions.tsx` from `OrderDetailsModal`     | --          | ~100       |
| 6.5  | Slim down `OrderDetailsModal.tsx`                       | 906         | ~200       |
| 6.6  | Extract `useSseConnection.ts` from `useCashierOrders`   | --          | ~150       |
| 6.7  | Extract `useOrderPolling.ts` from `useCashierOrders`    | --          | ~100       |
| 6.8  | Extract `useOrderActions.ts` from `useCashierOrders`    | --          | ~100       |
| 6.9  | Slim down `useCashierOrders.ts`                         | 688         | ~100       |
| 6.10 | Extract `useOrdersManagement.ts` hook                   | --          | ~200       |
| 6.11 | Extract `useCashierPage.ts` hook                        | --          | ~200       |
| 6.12 | Split `CustomerDiscountForm.tsx` into 3 sub-components  | 597         | ~150 each  |
| 6.13 | Extract `useReservationsManagement.ts` hook             | --          | ~200       |
| 6.14 | Extract `useCheckoutOrderType.ts` hook                  | --          | ~200       |

**Acceptance:** All split files under LOC limits, all pages/modals functional, SSE + polling work.

---

## Sprint 7: Admin & Customer Migration

**Goal:** Migrate remaining modules to design system. Eliminate all `any` types.

| #    | Task                                                 |
| ---- | ---------------------------------------------------- |
| 7.1  | Migrate `AdvancedOrderAnalytics.tsx` chart colors    |
| 7.2  | Migrate `ReservationCard.module.css` status colors   |
| 7.3  | Migrate `ReservationCalendar.tsx` event colors       |
| 7.4  | Replace `DeleteConfirmationModal` with `AlertDialog` |
| 7.5  | Migrate `table-statistics/page.tsx` status colors    |
| 7.6  | Migrate admin modals to `BaseModal` (5 modals)       |
| 7.7  | Fix `ResultModal.tsx` cross-domain CSS import        |
| 7.8  | Migrate checkout forms to `FormField`                |
| 7.9  | Migrate customer order pages to `StatusBadge`        |
| 7.10 | Fix `any` types in services (target: 0)              |
| 7.11 | Fix `any` types in components (target: 0)            |
| 7.12 | Fix `any` types in hooks & utils (target: 0)         |
| 7.13 | Migrate `app-internal-layout.tsx` inline styles      |
| 7.14 | Migrate `Sidebar.tsx` z-index + RTL prep             |

**Acceptance:** Zero `any` types, zero hardcoded hex colors in migrated modules, all admin/customer flows work.

---

## Sprint 8: RTL, Accessibility & Cleanup

**Goal:** Arabic RTL support, WCAG 2.1 AA, remove technical debt.

| #    | Task                                                            |
| ---- | --------------------------------------------------------------- |
| 8.1  | Add `dir` attribute logic (RTL detection from i18n language)    |
| 8.2  | Replace physical CSS with logical properties in layout files    |
| 8.3  | Replace physical CSS with logical properties in component files |
| 8.4  | Mirror directional icons for RTL                                |
| 8.5  | Add `:focus-visible` global styles                              |
| 8.6  | Add skip-to-content link                                        |
| 8.7  | Audit BaseModal accessibility                                   |
| 8.8  | Add `.sr-only` labels to StatusBadge                            |
| 8.9  | Color contrast audit (all text/bg pairs)                        |
| 8.10 | Touch target audit (min 44px on mobile)                         |
| 8.11 | Remove backward-compat CSS aliases                              |
| 8.12 | Remove deprecated modal CSS from globals.css                    |
| 8.13 | Remove `orderStatus.module.css` (replaced by StatusBadge)       |
| 8.14 | Z-index audit (all hardcoded values -> tokens)                  |
| 8.15 | Fix ResultModal to be self-contained                            |

**Acceptance:** Arabic layout mirrors correctly, keyboard navigation works, Lighthouse accessibility >= 90, zero hardcoded z-index/hex values.

---

## All God Files & Target State

> **Live status (2026-06-01).** "Now LOC" is the current file length; ✅ = under its §4 limit.
> The file-length CI gate is the real source of truth — anything still over-limit is in
> `scripts/file-length-baseline.txt`. Regen the baseline when a refactor lands (CLAUDE.md §4).

| File                               | Orig LOC | Limit | Now LOC | Status                                               |
| ---------------------------------- | -------- | ----- | ------- | ---------------------------------------------------- |
| `OrderDetailsModal.tsx`            | 906      | 200   | 136     | ✅ #92/#93                                           |
| `useCashierOrders.ts`              | 688      | 200   | 192     | ✅ (earlier Sprint 6 hook-extraction)                |
| `orders-management/page.tsx`       | 640      | 200   | 267     | ⛔ **remaining** (page→hook)                         |
| `cashier/page.tsx`                 | 611      | 200   | 196     | ✅ (earlier)                                         |
| `CustomerDiscountForm.tsx`         | 597      | 250   | 76      | ✅ #94                                               |
| `reservations-management/page.tsx` | 556      | 200   | 200     | ✅ (earlier)                                         |
| `serverService.ts`                 | 552      | 200   | 92      | ✅ (earlier)                                         |
| `orders/page.tsx`                  | 507      | 200   | 196     | ✅ (earlier)                                         |
| `useServerOrders.ts`               | 483      | 200   | 95      | ✅ (earlier)                                         |
| `useNotification.ts`               | 483      | 200   | 141     | ✅ #85                                               |
| `CartContext.tsx`                  | 481      | 250   | 170     | ✅ #95                                               |
| `app/reservations/page.tsx`        | 449      | 200   | 126     | ✅ #98                                               |
| `OrderDetails.tsx` (cashier)       | 448      | 250   | 114     | ✅ #100/#101                                         |
| `ProductCustomizationInBundle.tsx` | 446      | 250   | 128     | ✅ #99                                               |
| `AddressManagement.tsx`            | 455      | 250   | 88      | ✅ #103                                              |
| `app/cart/page.tsx`                | 437      | 200   | 108     | ✅ #102                                              |
| `types/order.ts`                   | 407      | 150   | 14      | ✅ #88                                               |
| `checkout/confirmation/page.tsx`   | 456      | 200   | 436     | ⛔ **remaining** (page→hook; ⚠️ critical order-flow) |
| `TaxConfigurationManager.tsx`      | 458      | 250   | 434     | ⛔ **remaining**                                     |
| `TakeOrderModal.tsx`               | 456      | 200   | 430     | ⛔ **remaining** (⚠️ critical order-flow)            |
| `checkout/review/page.tsx`         | —        | 200   | 420     | ⛔ **remaining** (page→hook; ⚠️ critical order-flow) |
| `CashierDiagnostics.tsx`           | —        | 250   | 421     | ⛔ **remaining**                                     |
| `ProductIngredientsManager.tsx`    | 423      | 250   | 370     | ⛔ **remaining**                                     |
| `useTableLayout.ts`                | —        | 200   | 315     | ⛔ **remaining** (hook; split by concern)            |

> Routes `order-type/page.tsx`, `table-layout-editor/page.tsx`, `customer-info/page.tsx` from the
> original plan no longer exist at those paths (removed/renamed) — dropped from the table.

---

## Test Coverage Roadmap

| Phase                           | Sprint     | New Tests | Cumulative | Est. Coverage |
| ------------------------------- | ---------- | --------- | ---------- | ------------- |
| Phase 1 (Infrastructure + Auth) | Sprint 1.5 | 20        | 80         | ~10%          |
| Phase 2 (Services)              | Sprint 4   | 63        | 143        | ~30%          |
| Phase 3 (Hooks)                 | Sprint 5   | 34        | 177        | ~45%          |
| Phase 4 (Components)            | Sprint 5-6 | 64        | 241        | ~65%          |
| Phase 5 (Contexts)              | Sprint 6   | 31        | 272        | ~75%          |
| Phase 6 (E2E - Playwright)      | Sprint 7-8 | 32        | 304        | **80%+**      |

See `docs/TEST-COVERAGE-PLAN.md` for full details.
