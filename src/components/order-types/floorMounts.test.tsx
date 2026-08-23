import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/components/AuthContext';
import { getCategories } from '@/services/categoryService';
import CashierHeader from '@/components/cashier/CashierHeader';
import ServerHeader from '@/components/server/ServerHeader';

jest.mock('@/services/categoryService');
jest.mock('@/components/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallbackOrOptions?: unknown, options?: Record<string, unknown>) => {
      const fallback = typeof fallbackOrOptions === 'string' ? fallbackOrOptions : key;
      const vars = (typeof fallbackOrOptions === 'object' ? fallbackOrOptions : options) as
        Record<string, unknown> | undefined;
      const text = typeof vars?.defaultValue === 'string' ? vars.defaultValue : fallback;
      return Object.entries(vars ?? {}).reduce(
        (out, [name, value]) => out.replaceAll(`{{${name}}}`, String(value)),
        text,
      );
    },
  }),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGetCategories = getCategories as jest.MockedFunction<typeof getCategories>;

const DURUM = {
  id: 'c1',
  name: 'Wraps',
  isActive: true,
  displayOrder: 0,
  availableOrderTypes: 6,
  updatedAt: new Date(Date.now() - 25 * 60_000).toISOString(),
};

function signedInAs(role: string) {
  mockUseAuth.mockReturnValue({
    user: { firstName: 'A', lastName: 'B', email: 'a@b.c', role, accessToken: 'x' },
    login: jest.fn(),
    logout: jest.fn(),
    isLoading: false,
  });
}

const cashierProps = {
  isConnected: true,
  isRefreshing: false,
  audioEnabled: false,
  soundType: 'bell' as never,
  repeatUntilMouseMoves: false,
  onRefresh: jest.fn(),
  onToggleAudio: jest.fn(),
  onSoundTypeChange: jest.fn(),
  onTestSound: jest.fn(),
  onToggleRepeat: jest.fn(),
  onOpenQRScanner: jest.fn(),
};

const serverProps = {
  isConnected: true,
  connectionState: 'connected' as const,
  lastEventTime: null,
  error: null,
  statusFilter: 'active',
  onStatusFilterChange: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCategories.mockResolvedValue({ success: true, data: { items: [DURUM], totalCount: 1 } } as never);
});

/**
 * The two FLOOR mounts of the F6 toggle. These exist as their own suite because the mount is the
 * whole point of the slice — the control was always reachable from admin settings, and "a waiter can
 * see it without leaving the order screen" is the behaviour being shipped. A silent regression here
 * (an import dropped in a header refactor) would leave every other test green.
 */
describe('the pinned order-type toggle on the floor screens', () => {
  it.each([
    ['cashier', () => render(<CashierHeader {...cashierProps} />)],
    ['server', () => render(<ServerHeader {...serverProps} />)],
  ])('is mounted on the %s screen for an admin signed in on the till', async (_surface, renderHeader) => {
    signedInAs('Admin');
    renderHeader();

    expect(await screen.findByText('Wraps: closed to Dine In · for 25 min')).toBeInTheDocument();
  });

  it.each([
    ['cashier', 'Cashier', () => render(<CashierHeader {...cashierProps} />)],
    ['server', 'Server', () => render(<ServerHeader {...serverProps} />)],
  ])(
    'renders nothing on the %s screen under its own role, whose token the writer would 403',
    async (_surface, role, renderHeader) => {
      signedInAs(role);
      renderHeader();

      expect(screen.queryByRole('button', { name: /Order type availability/ })).not.toBeInTheDocument();
      await waitFor(() => expect(mockGetCategories).not.toHaveBeenCalled());
    },
  );
});
