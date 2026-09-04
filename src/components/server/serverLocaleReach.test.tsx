import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import CustomerInfoPanel from './CustomerInfoPanel';
import ServerHeader from './ServerHeader';
import OrderCard from './OrderCard';
import type { UserDto } from '@/services/serverService';
import type { OrderDto } from '@/types/order';

/**
 * #610 — the three waiter-screen strings NO locale bundle can reach.
 *
 * Each of these was invisible to both i18n gates for the same reason: the text never passes through
 * `t()`, so `check-t-keys.mjs` (which reads callsites) cannot see it and `check-locale-parity.mjs`
 * (which reads bundles) has nothing to compare. Translating all ten files fixes none of them.
 *
 *   1. `pts` was written inline in JSX beside a translated label — English in all ten locales.
 *   2. `toLocaleTimeString()` with NO argument follows the BROWSER, not the app: a German waiter on
 *      an en-US tablet reads a German label beside a `3:45:12 PM` clock.
 *   3. the order card one component over had the same bug spelled `toLocaleTimeString([])`, which
 *      is not "no preference" — it is the browser's locale too.
 *
 * The clock assertions compare against a value COMPUTED with the same API, never a literal: the
 * runner's ambient locale and timezone are not ours to assume (CLAUDE.md §7), and a hardcoded
 * "15:45" would pin the machine rather than the fix. The discriminator is that `de` and `en-US`
 * disagree about the 24-hour clock, which is asserted explicitly so the test cannot pass by
 * accident on a runner where the two formats coincide.
 */

const AT = new Date('2026-08-28T15:45:12Z');
const HM: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

/**
 * A language whose clock the RUNNER's own default does not already produce — chosen, not assumed.
 *
 * The first draft pinned `de` and the premise assertion caught it: on this runner `de` and the
 * ambient default both render `17:45`, so the suite could not have told the fix from the bug. The
 * ambient locale is the machine's, so the discriminating locale has to be derived at run time.
 */
const mockLocale =
  ['ar-EG', 'ja-JP', 'de-DE', 'en-US'].find(
    (l) =>
      AT.toLocaleTimeString(l) !== AT.toLocaleTimeString() &&
      AT.toLocaleTimeString(l, HM) !== AT.toLocaleTimeString([], HM),
  ) ?? 'ar-EG';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // A distinct, non-English value per key: an assertion against the fallback would pass on the
    // hardcoded literal too, which is the whole defect.
    t: (key: string, fallback?: string) => (key === 'server.points_unit' ? 'Pkt.' : (fallback ?? key)),
    i18n: { language: mockLocale },
  }),
}));

// Renders only for a signed-in admin and pulls in AuthContext; not what this suite is about.
jest.mock('@/components/order-types/CategoryChannelQuickToggle', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/services/serverService', () => ({
  getUserFidelityBalance: jest.fn().mockResolvedValue({ currentPoints: 420 }),
  getUserDiscountRules: jest.fn().mockResolvedValue([]),
  calculateDiscountFromPoints: (points: number) => points / 100,
  calculatePointsToEarn: (total: number) => Math.floor(total),
}));

const user = {
  id: 'user-1',
  fullName: 'Ayşe Yılmaz',
  firstName: 'Ayşe',
  lastName: 'Yılmaz',
  isDiscountActive: false,
  discountPercentage: 0,
} as unknown as UserDto;

describe('#610 — the fidelity-points unit is translated, not baked into the JSX', () => {
  it('renders the tenant-language unit beside every points figure', async () => {
    render(<CustomerInfoPanel user={user} orderTotal={50} pointsToRedeem={200} onPointsChange={jest.fn()} />);

    // Balance, redeem readout and the earn row — three separate literals in the JSX before the fix.
    await waitFor(() => expect(screen.getByText(/420\s+Pkt\./)).toBeInTheDocument());
    expect(screen.getByText(/200\s+Pkt\./)).toBeInTheDocument();
    expect(screen.getByText(/48\s+Pkt\./)).toBeInTheDocument();

    // And the English unit is gone from the panel entirely.
    expect(screen.queryByText(/\bpts\b/)).not.toBeInTheDocument();
  });
});

describe('#610 — the waiter clocks follow the APP language, not the browser', () => {
  const at = AT;

  it('the header timestamp is formatted with the i18n language', () => {
    render(
      <ServerHeader
        isConnected
        connectionState="connected"
        lastEventTime={at}
        error={null}
        statusFilter="active"
        onStatusFilterChange={jest.fn()}
      />,
    );

    const expected = at.toLocaleTimeString(mockLocale);
    // The premise, asserted rather than assumed: if the runner formatted `de` and its own default
    // identically, this suite could not tell a fix from the bug it replaces.
    expect(expected).not.toBe(at.toLocaleTimeString());
    expect(screen.getByText(new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
  });

  it('the order card timestamp is formatted with the i18n language', () => {
    const order = {
      id: 'o1',
      orderNumber: '1042',
      tableNumber: '7',
      status: 'Pending',
      orderDate: at.toISOString(),
      totalAmount: 42,
      items: [],
    } as unknown as OrderDto;

    render(<OrderCard order={order} onStatusChange={jest.fn()} />);

    const expected = at.toLocaleTimeString(mockLocale, HM);
    expect(expected).not.toBe(at.toLocaleTimeString([], HM));
    expect(screen.getByText(new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
  });
});
