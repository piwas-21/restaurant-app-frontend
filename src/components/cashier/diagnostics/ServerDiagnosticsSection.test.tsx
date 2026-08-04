import { render, screen } from '@testing-library/react';
import ServerDiagnosticsSection from './ServerDiagnosticsSection';
import { getEventsDiagnostics } from '@/services/cashierService';
import type { SseDiagnostics } from '@/types/diagnostics';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));
jest.mock('@/services/cashierService', () => ({ getEventsDiagnostics: jest.fn() }));

const mockDiagnostics = getEventsDiagnostics as jest.Mock;

const diagnostics = (timestamp: string): SseDiagnostics => ({
  totalClients: 1,
  kitchenClients: 1,
  serviceClients: 0,
  managerClients: 0,
  stockClients: 0,
  clientsWithErrors: 0,
  totalErrors: 0,
  totalSuccessfulSends: 4,
  totalFailedSends: 0,
  clientDetails: {},
  recentErrors: [],
  recentLogs: [],
  timestamp,
});

beforeEach(() => jest.clearAllMocks());

/**
 * The guard these pin (E9 slice 8). `formatTimestamp` was a try/catch whose catch returned the raw
 * string — but `toLocaleTimeString()` does NOT throw on an unparseable date. `new Date('nonsense')`
 * is an Invalid Date and its `toLocaleTimeString()` RETURNS the literal "Invalid Date" (only
 * `toISOString()` throws RangeError). So the fallback was unreachable and a malformed timestamp
 * from the diagnostics endpoint rendered as "Invalid Date" on a cashier's screen.
 */
describe('ServerDiagnosticsSection — the timestamp fallback', () => {
  it('renders the raw value when the timestamp cannot be parsed', async () => {
    mockDiagnostics.mockResolvedValue(diagnostics('not-a-timestamp'));
    render(<ServerDiagnosticsSection />);

    expect(await screen.findByText(/not-a-timestamp/)).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });

  it('still formats a parseable timestamp', async () => {
    const iso = '2026-08-03T14:30:00.000Z';
    mockDiagnostics.mockResolvedValue(diagnostics(iso));
    render(<ServerDiagnosticsSection />);

    expect(await screen.findByText(new RegExp(new Date(iso).toLocaleTimeString()))).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(iso))).not.toBeInTheDocument();
  });
});
