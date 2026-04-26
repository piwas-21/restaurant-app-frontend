# Frontend Development Guidelines

> Next.js 15.5 | React 19 | TypeScript 5 | CSS Modules | i18next (9 languages)

---

## Architecture Overview

```
frontend/src/
  app/                  # Next.js App Router (pages, layouts)
  components/           # Reusable UI components (by feature)
  design-system/        # Design tokens, shared components (planned)
  hooks/                # Custom React hooks
  contexts/             # Context providers (Auth, Cart, Session, Theme...)
  services/             # API service layer (1 file per feature)
  types/                # TypeScript type definitions
  utils/                # Pure utility functions
  schemas/              # Zod validation schemas
  config/               # Language & payment configs
  locales/              # i18n translation files (9 languages)
  styles/               # Shared CSS modules
```

### Key Patterns
- **100% functional components** with hooks
- **Context API** for state management (no Redux/Zustand)
- **CSS Modules** for scoped styling with global CSS variables
- **i18next** for internationalization (en, de, tr, it, ar, fr, es, ru, zh)
- **Centralized API client** (`apiClient.ts`) with token refresh

---

## File Length Limits

| File Type | Max LOC | Rationale |
|---|---|---|
| Page component (`app/`) | 200 | Logic belongs in custom hooks |
| UI Component (`.tsx`) | 250 | Focused presentational components |
| Modal component | 200 | Must use `BaseModal` wrapper |
| Custom hook | 200 | Split by concern beyond this |
| Service file | 200 | API calls only, no business logic |
| Type/interface file | 150 | Pure type definitions |
| Utility file | 150 | Pure functions |
| CSS Module | 200 | Split by component, not by page |

---

## Naming Conventions

### Files
- **Components**: PascalCase - `OrderDetailsModal.tsx`
- **Hooks**: camelCase with `use` prefix - `useCashierOrders.ts`
- **Services**: camelCase with `Service` suffix - `orderService.ts`
- **CSS Modules**: camelCase matching component - `OrderDetailsModal.module.css`
- **Types**: camelCase - `order.ts`, `reservation.ts`

### Components
- **Overlay components**: Always `*Modal` (NOT `*Dialog`)
- **Exports**: `export default function ComponentName`
- **Props**: Interface above component, named `{ComponentName}Props`

```tsx
// GOOD
interface OrderHeaderProps {
  order: OrderDto;
  onStatusChange: (status: string) => void;
}

export default function OrderHeader({ order, onStatusChange }: OrderHeaderProps) {
  // ...
}
```

---

## Component Architecture

### Page Components (max 200 LOC)
Pages **orchestrate** only -- all logic lives in custom hooks:

```tsx
// GOOD - page delegates to hook
export default function OrdersManagementPage() {
  const { orders, filters, setFilters, isLoading } = useOrdersManagement();
  return <OrdersTable orders={orders} filters={filters} ... />;
}

// BAD - page contains business logic
export default function OrdersManagementPage() {
  const [orders, setOrders] = useState([]);
  const [filters, setFilters] = useState({});
  useEffect(() => { fetchOrders().then(setOrders); }, []);
  const handleFilter = (f) => { /* 50 lines of filter logic */ };
  // ...200+ more lines
}
```

### Modal Components (max 200 LOC)
All modals MUST use the `BaseModal` wrapper from the design system:

```tsx
import { BaseModal } from '@/design-system/components';

export default function EditOrderModal({ isOpen, onClose, order }: Props) {
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Edit Order" size="lg">
      {/* modal content */}
    </BaseModal>
  );
}
```

### Custom Hooks (max 200 LOC)
Extract logic from pages/components into reusable hooks:

```tsx
// GOOD - focused hook
export function useOrderActions(orderId: string) {
  const updateStatus = async (status: string) => { ... };
  const cancelOrder = async (reason: string) => { ... };
  return { updateStatus, cancelOrder };
}
```

---

## Styling Rules

### CSS Modules Required
- Every component gets its own `.module.css` file
- **No inline styles** except dynamically computed values (e.g., `style={{ width: `${percent}%` }}`)
- **No hardcoded hex colors** -- always use CSS variables

```css
/* GOOD */
.statusBadge {
  background-color: var(--status-order-pending-bg);
  color: var(--status-order-pending-text);
  border-radius: var(--radius-md);
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
}

/* BAD */
.statusBadge {
  background-color: #fef3c7;
  color: #92400e;
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 12px;
}
```

### Dark Mode
- Uses `html[data-theme="dark"]` attribute (NOT `@media (prefers-color-scheme: dark)`)
- In CSS Modules use `:global(html[data-theme="dark"]) .className` selector
- All design tokens have dark mode overrides

### Design Tokens (CSS Variables)
Use tokens from the design system for all visual properties:

| Category | Examples |
|---|---|
| Colors | `--brand-primary`, `--feedback-success`, `--text-primary` |
| Status | `--status-order-pending-bg`, `--status-payment-paid-text` |
| Spacing | `--space-1` (4px) through `--space-16` (64px) |
| Typography | `--text-xs` (12px) through `--text-3xl` (30px) |
| Shadows | `--shadow-sm` through `--shadow-xl`, `--shadow-modal` |
| Borders | `--radius-sm` (4px) through `--radius-full` (9999px) |
| Z-index | `--z-header` (1000), `--z-modal` (1400), `--z-tooltip` (1600) |
| Animation | `--transition-fast` (150ms), `--transition-normal` (200ms) |

---

## TypeScript Rules

### No `any` Type
Use `unknown` with type guards instead:

```tsx
// GOOD
} catch (error: unknown) {
  if (error instanceof ApiError) {
    showError(error.message);
  }
}

// BAD
} catch (error: any) {
  showError(error.message);
}
```

### Type Definitions
- One file per domain concept in `types/`
- Use `interface` for object shapes, `type` for unions/intersections
- Export all types needed by other files

---

## API Integration

### Service Layer
- One service file per feature in `services/`
- Services contain **only** API calls -- no state management
- All calls go through `apiClient.ts`

```tsx
// services/orderService.ts
export const getOrders = async (filters: OrderFilters): Promise<OrderDto[]> => {
  return apiClient.get<OrderDto[]>('/api/Orders', { params: filters, requireAuth: true });
};
```

### Error Handling
- API errors are `ApiError` instances with `.status` and `.message`
- Services should let errors propagate (don't catch and swallow)
- Components handle errors in the UI layer

---

## State Management

### Context API Providers
- `AuthContext` - User authentication state
- `SessionContext` - Anonymous session (X-Session-Id)
- `CartContext` - Shopping cart with optimistic updates
- `ThemeContext` - Dark/light mode toggle
- `CheckoutContext` - Checkout flow state

### Rules
- Contexts provide state + actions via custom hooks
- Components consume via `useAuth()`, `useCart()`, etc.
- Never put business logic directly in context providers -- extract to hooks

---

## i18n (Internationalization)

- 9 languages: en, de, tr, it, ar, fr, es, ru, zh
- All user-visible text must use `const { t } = useTranslation()`
- Translation files in `locales/{lang}.json`
- Arabic requires RTL support (planned for Sprint 8)

---

## Shared Components (Design System)

Use design system components for common UI patterns:

| Component | Use For |
|---|---|
| `BaseModal` | All modal/overlay components (60+ modals) |
| `AlertDialog` | Confirm/cancel dialogs |
| `FormField` | Label + input + error pattern in forms |
| `StatusBadge` | Order/payment/reservation status display |
| `Button` | All buttons (primary, secondary, danger, ghost) |
| `LoadingSpinner` | Loading indicators (inline, card, fullPage) |
| `EmptyState` | Empty list/search results |
| `DataTable` | Tabular data display |
| `Card` | Content containers |
| `PageLayout` | Page header + content wrapper |

---

## Error Handling

### Error Boundaries
- Add `error.tsx` files per Next.js App Router segment for automatic error boundaries
- Wrap critical UI sections with error boundary components
- Always provide fallback UI (never leave user with blank screen)

### API Error Handling
- API errors are `ApiError` instances with `.status` and `.message`
- Services should let errors propagate -- don't catch and swallow
- Components handle errors in the UI layer via try/catch or error state
- Use `useNotification()` hook or notistack for user-facing error messages
- **Never** use `catch (error: any)` -- use `catch (error: unknown)` with type guards

```tsx
// GOOD
try {
  await createOrder(data);
} catch (error: unknown) {
  if (error instanceof ApiError) {
    showError(error.message);
  } else {
    showError('An unexpected error occurred');
  }
}

// BAD
} catch (error: any) {
  console.log(error);
}
```

### Console Logging
- **No `console.log()` in production** -- guard with environment check or remove
- Use `console.error()` only for genuine errors, not debugging
- Never log tokens, passwords, or PII

---

## Route Protection

### AdminAuthGuard Pattern
All protected pages wrap content in `AdminAuthGuard`:
```tsx
<AdminAuthGuard requiredRoles={['Admin', 'Cashier']}>
  <PageContent />
</AdminAuthGuard>
```

### Protected Routes
| Route | Required Roles |
|-------|---------------|
| `/admin/*` | Admin |
| `/cashier/*` | Admin, Cashier |
| `/kitchen-staff/*` | Admin, KitchenStaff |
| `/account/*` | Any authenticated user |

**Important:** Client-side route protection is NOT sufficient alone. Backend MUST validate authorization on every API request.

---

## Form Handling

### react-hook-form + Zod (Preferred Pattern)
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@/schemas/auth.schema';

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(loginSchema),
});
```

### Rules
- All forms MUST have Zod validation schemas
- Use `FormField` component for consistent label+input+error rendering
- Prefer `useForm()` with `register()` for simple fields
- Use `Controller` for complex fields (datepickers, selects, custom inputs)
- Schemas live in `src/schemas/` directory

---

## Performance

- Use `useCallback` for callbacks passed to child components
- Use `React.memo` for expensive list item components
- **Dynamic imports for modals:** `const Modal = dynamic(() => import('./Modal'))` -- all 48+ modals should be lazy-loaded
- Images use Next.js `<Image>` component (note: `unoptimized: true` currently set in config)
- Lists with 100+ items should use virtualization (react-window or @tanstack/virtual)
- Don't premature-optimize -- measure first, optimize second

---

## Security

See `docs/SECURITY-AUDIT.md` for full audit findings.

Key rules:
- **Never store tokens in localStorage** in production (use httpOnly cookies)
- **Never put sensitive tokens in URL parameters** (use POST body)
- **Never commit credentials** to `.env` (use `.env.local`)
- **Always validate file uploads** (type whitelist + size limit)
- **Use `crypto.randomUUID()`** for session IDs (not `Math.random()`)
- **Guard console.log** with `process.env.NODE_ENV` check

---

## Testing

See `docs/TEST-COVERAGE-PLAN.md` for full strategy.

- **Jest** for unit/integration tests, **Playwright** for E2E
- Coverage target: 80%+ overall
- Enable `collectCoverage: true` in `jest.config.js`
- Use `@testing-library/react` for component tests
- Use `renderWithProviders()` utility for tests needing context
- Create test factories in `test-utils/factories.ts` for common mock objects
- CI/CD: Tests MUST run in GitLab pipeline before merge
