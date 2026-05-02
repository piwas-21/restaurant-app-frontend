# Frontend Test Coverage Plan

> Target: 80%+ code coverage | Current: ~2% estimated

---

## Current State

### Infrastructure (Configured but Underused)
- **Unit/Integration:** Jest + jest-environment-jsdom + babel-jest
- **E2E:** Playwright configured (but no tests written)
- **Mocking:** Manual jest mocks for apiClient (get/post/put/delete/patch)
- **Assertions:** Jest built-in (no FluentAssertions equivalent)
- **Coverage tool:** coverlet via Jest `--coverage` (DISABLED: `collectCoverage: false`)

### Existing Tests (~60 total)

| File | Tests | Type | Coverage |
|------|-------|------|----------|
| `basketService.test.ts` | ~15 | Service (mock API) | Happy path + errors |
| `orderService.test.ts` | ~15 | Service (mock API) | Happy path + errors |
| `userService.test.ts` | ~6 | Service (mock API) | Happy path + errors |
| `fidelityPointsService.test.ts` | ~15 | Service (mock API) | Comprehensive |
| `auth.schema.test.ts` | ~9 | Schema validation | Login + registration |
| **TOTAL** | **~60** | | |

### What Has ZERO Tests

| Category | Files | Gap |
|----------|-------|-----|
| Components | 183 | 100% untested |
| Hooks | 19 | 100% untested |
| Pages | 42 | 100% untested |
| Contexts | 7 | 100% untested |
| Services | 20 of 24 | 83% untested |
| Utils | 15 | 100% untested |
| E2E flows | all | 100% (Playwright configured but empty) |

### Critical Gap: Coverage Disabled

`jest.config.js` has `collectCoverage: false`. Coverage thresholds exist (80%) but are never enforced.

---

## Test Architecture

### Layer 1: Service Tests (Existing Pattern - Expand)
Mock `apiClient`, test request/response handling.

```typescript
// Pattern: mock apiClient, call service, verify request + response
jest.mock('@/utils/apiClient');
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

test('getOrders calls correct endpoint with filters', async () => {
  mockApiClient.get.mockResolvedValue({ data: mockOrders });
  const result = await getOrders({ status: 'Pending', page: 1 });
  expect(mockApiClient.get).toHaveBeenCalledWith('/api/Orders?status=Pending&page=1', expect.anything());
  expect(result).toEqual(mockOrders);
});
```

### Layer 2: Hook Tests (NEW)
Use `@testing-library/react` + `renderHook`.

```typescript
import { renderHook, act } from '@testing-library/react';

test('useSession creates session on mount', () => {
  const { result } = renderHook(() => useSession());
  expect(result.current.sessionId).toBeTruthy();
  expect(result.current.sessionId).toMatch(/^[0-9a-f-]{36}$/);
});
```

### Layer 3: Component Tests (NEW)
Use `@testing-library/react` + `jest-dom`.

```typescript
import { render, screen, fireEvent } from '@testing-library/react';

test('StatusBadge renders correct color for pending order', () => {
  render(<StatusBadge status="Pending" type="order" />);
  const badge = screen.getByText('Pending');
  expect(badge).toHaveClass('statusPending');
});
```

### Layer 4: E2E Tests (NEW - Playwright)

Full browser flows. **Authoritative rules** for E2E (scope, tiering, selectors, auth, reliability, CI) live in [E2E-STRATEGY.md](E2E-STRATEGY.md). This phase plan is the *what*; the strategy is the *how*.

```typescript
// e2e/tests/customer/checkout.e2e.ts
import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from '../../helpers/a11y';

test('customer can place a guest order from the public menu', async ({ page }) => {
  await page.goto('/menu');
  await expectNoA11yViolations(page);

  await page.getByRole('button', { name: /add to cart/i }).first().click();
  await page.getByRole('link', { name: /cart/i }).click();
  await page.getByRole('button', { name: /checkout/i }).click();
  await page.getByLabel(/name/i).fill('Test User');
  // ...
  await expect(page.getByRole('heading', { name: /order confirmed/i })).toBeVisible();
});
```

Key deltas from earlier drafts:
- **Role-based selectors** (`getByRole`, `getByLabel`, `getByText`) preferred over `data-testid`. `data-testid` only as a last resort — see strategy §Selector strategy.
- **One file per flow**, not per page. Files live under `e2e/tests/<surface>/`.
- **Per-role auth fixtures** (customer / cashier / server / kitchen / admin) seed via the backend API, not stubbed contexts.

---

## Test Implementation Plan

### Phase 1: Infrastructure & Security Tests (Sprint 1.5)

| Task | Details |
|------|---------|
| Enable coverage | Set `collectCoverage: true` in jest.config.js |
| Fix missing mock | Create `__mocks__/nextRouterMock.js` |
| Install testing-library | `npm i -D @testing-library/react @testing-library/jest-dom @testing-library/user-event` |
| Create test utilities | `test-utils/renderWithProviders.tsx` (wraps Auth + Session + Cart contexts) |
| Create test factories | `test-utils/factories.ts` (createMockOrder, createMockProduct, etc.) |

| Test File | Tests | What It Covers |
|-----------|-------|----------------|
| `authService.test.ts` | 10 | Login, register, refresh, logout, Google/Apple auth |
| `sessionService.test.ts` | 5 | Create, validate UUID, expiry, refresh |
| `auth.schema.test.ts` (expand) | 5 | Edge cases: empty fields, SQL injection strings, XSS payloads |

**Total: ~20 new tests**

### Phase 2: Service Tests (Sprint 4)

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `productService.test.ts` | 10 | CRUD, search, images, availability |
| `categoryService.test.ts` | 6 | CRUD, reorder |
| `reservationService.test.ts` | 8 | CRUD, time slots, status |
| `menuService.test.ts` | 8 | Bundle CRUD, sections |
| `cashierService.test.ts` | 8 | Order operations, payments |
| `addressService.test.ts` | 5 | CRUD |
| `tableLayoutService.test.ts` | 5 | Layout operations |
| `serverService.test.ts` | 6 | Server order operations |
| `workingHoursService.test.ts` | 4 | CRUD |
| `emailService.test.ts` | 3 | Send operations |

**Total: ~63 new tests**

### Phase 3: Hook Tests (Sprint 5)

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `useSession.test.ts` | 5 | Create, validate, refresh, cleanup |
| `useNotification.test.ts` | 6 | Show/hide, sound, types, auto-dismiss |
| `usePublicMenu.test.ts` | 4 | Fetch, filter, cache |
| `useProductForm.test.ts` | 6 | Validation, submit, image handling |
| `useCategoryManagement.test.ts` | 4 | CRUD operations |
| `useTableLayout.test.ts` | 5 | Drag/drop, save, load |
| `useKeyboardShortcuts.test.ts` | 4 | Register, unregister, conflict |

**Total: ~34 new tests**

### Phase 4: Component Tests (Sprint 5-6)

**Design System Components (highest priority):**

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `BaseModal.test.tsx` | 8 | Open/close, escape, backdrop, focus trap, ARIA, portal |
| `AlertDialog.test.tsx` | 6 | Confirm, cancel, loading, type-to-confirm |
| `FormField.test.tsx` | 5 | Label, error, required, hint |
| `StatusBadge.test.tsx` | 8 | All order/payment/reservation statuses, dark mode |
| `Button.test.tsx` | 7 | Variants, sizes, loading, disabled, icons |
| `LoadingSpinner.test.tsx` | 3 | Variants (inline, card, fullPage) |
| `EmptyState.test.tsx` | 3 | Icon, action button, description |

**Feature Components:**

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `AdminAuthGuard.test.tsx` | 5 | Redirect unauthenticated, role check, allow admin |
| `CashierHeader.test.tsx` | 4 | Render, action buttons, connection status |
| `OrderList.test.tsx` | 5 | Render orders, status badges, click handler |
| `ReservationCard.test.tsx` | 4 | Status display, actions, time formatting |
| `LanguageSwitcher.test.tsx` | 3 | Switch language, RTL detection |
| `ThemeSwitcher.test.tsx` | 3 | Toggle, persist preference |

**Total: ~64 new tests**

### Phase 5: Context Tests (Sprint 6)

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `AuthContext.test.tsx` | 8 | Login state, logout, token refresh, role access |
| `CartContext.test.tsx` | 10 | Add/remove/update items, pricing, optimistic updates, rollback |
| `SessionContext.test.tsx` | 5 | Create session, refresh, cleanup |
| `ThemeContext.test.tsx` | 3 | Toggle, persist, detect system preference |
| `CheckoutContext.test.tsx` | 5 | Flow state, address, payment method |

**Total: ~31 new tests**

### Phase 6: E2E Tests (Sprint 7-8)

> Scoped per [E2E-STRATEGY.md](E2E-STRATEGY.md) — **HIGH** tier only ships in this phase; **MED** items roll in opportunistically when adjacent flows are touched.

| Test File | Tier | Tests | Coverage |
|-----------|------|-------|----------|
| `tests/auth/register-login.e2e.ts` | HIGH | 4 | Register → verify → login → logout; failed login surfaces error |
| `tests/public/menu-and-cart.e2e.ts` | HIGH | 4 | Browse menu, add items with options, view cart, update quantities |
| `tests/customer/checkout-guest.e2e.ts` | HIGH | 3 | Guest checkout (delivery / pickup / dine-in), confirmation visible |
| `tests/customer/checkout-authed.e2e.ts` | HIGH | 3 | Logged-in checkout reusing saved address; order appears in `/my-orders` |
| `tests/cashier/order-flow.e2e.ts` | HIGH | 4 | Cashier sees incoming order, updates status, marks paid |
| `tests/server/take-order.e2e.ts` | HIGH | 3 | Open table layout, seat guests, send order to kitchen |
| `tests/admin/products.e2e.ts` | HIGH | 3 | Create product, upload image, toggle availability → visible on public menu |
| `tests/admin/orders.e2e.ts` | HIGH | 3 | Filter, view details, cancel/refund (boundary-mocked) |
| `tests/customer/reservations.e2e.ts` | HIGH | 3 | Customer creates reservation → admin approves → status syncs |
| `tests/public/locale-rtl.e2e.ts` | HIGH | 2 | Switch to `ar`, layout mirrors, primary CTA reachable |

**Total: ~32 E2E tests** (HIGH tier). MED tier (theme/locale persistence, fidelity points balance, `/scan` landing) adds ~5 more if cheap.

---

## Coverage Configuration

### Enable Coverage in jest.config.js

```javascript
module.exports = {
  collectCoverage: true,  // Change from false
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/components/**/*.{ts,tsx}',
    'src/app/**/*.{ts,tsx}',
    'src/hooks/**/*.{ts,tsx}',
    'src/services/**/*.{ts,tsx}',
    'src/contexts/**/*.{ts,tsx}',
    'src/utils/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80,
    },
  },
};
```

### Fix Missing Mock

Create `__mocks__/nextRouterMock.js`:
```javascript
const useRouter = jest.fn(() => ({
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  pathname: '/',
  query: {},
}));
module.exports = { useRouter };
```

### Test Utility: renderWithProviders

```typescript
// test-utils/renderWithProviders.tsx
import { render } from '@testing-library/react';
import { AuthProvider } from '@/components/AuthContext';
import { SessionProvider } from '@/contexts/SessionContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

export function renderWithProviders(ui: React.ReactElement, options = {}) {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <AuthProvider>
          {ui}
        </AuthProvider>
      </SessionProvider>
    </ThemeProvider>,
    options
  );
}
```

---

## CI/CD Integration

Update `.gitlab-ci.yml` test job:

```yaml
npm_test:
  stage: test
  image: node:18-bullseye
  before_script:
    - npm ci
  script:
    - npm test -- --coverage --ci --reporters=default --reporters=jest-junit
  artifacts:
    when: always
    paths:
      - coverage/
      - junit.xml
    reports:
      junit: junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
  coverage: '/All files[^|]*\|[^|]*\s+([\d.]+)/'
```

---

## Coverage Targets

### By Category

| Category | Current | Phase | Target |
|----------|---------|-------|--------|
| Services | ~17% (4/24) | Phase 1-2 | 90% |
| Hooks | 0% | Phase 3 | 75% |
| Components | 0% | Phase 4 | 70% |
| Contexts | 0% | Phase 5 | 80% |
| Utils | 0% | Phase 2 | 85% |
| Pages | 0% | Phase 6 (E2E) | 50% |
| **Overall** | **~2%** | | **80%+** |

### By Test Type

| Type | Current | Target | Tests to Write |
|------|---------|--------|----------------|
| Service (unit) | ~60 | ~123 | ~63 new |
| Hook (unit) | 0 | ~34 | 34 new |
| Component (integration) | 0 | ~64 | 64 new |
| Context (integration) | 0 | ~31 | 31 new |
| E2E (Playwright) | 0 | ~32 | 32 new |
| **Total** | **~60** | **~284** | **~224 new** |

---

## Estimated Timeline

| Phase | Sprint | New Tests | Cumulative | Est. Coverage |
|-------|--------|-----------|------------|---------------|
| Phase 1 (Infrastructure + Auth) | Sprint 1.5 | 20 | 80 | ~10% |
| Phase 2 (Services) | Sprint 4 | 63 | 143 | ~30% |
| Phase 3 (Hooks) | Sprint 5 | 34 | 177 | ~45% |
| Phase 4 (Components) | Sprint 5-6 | 64 | 241 | ~65% |
| Phase 5 (Contexts) | Sprint 6 | 31 | 272 | ~75% |
| Phase 6 (E2E) | Sprint 7-8 | 32 | 304 | **80%+** |
