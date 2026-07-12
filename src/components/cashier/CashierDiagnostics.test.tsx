import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import CashierDiagnostics from './CashierDiagnostics';
import { getEventsDiagnostics } from '@/services/cashierService';
import type { SseDiagnostics } from '@/types/diagnostics';

// Stub react-i18next so t() returns the key (the component uses the
// `t('key') || 'Fallback'` pattern, so with no fallback arg the key is what
// renders) without requiring the i18next provider in the test tree.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

// The server-diagnostics section fetches on mount; mock the service so the
// tests drive the loaded / error branches deterministically.
jest.mock('@/services/cashierService', () => ({
  getEventsDiagnostics: jest.fn(),
}));

const mockGetEventsDiagnostics = getEventsDiagnostics as jest.MockedFunction<typeof getEventsDiagnostics>;

const sampleDiagnostics: SseDiagnostics = {
  totalClients: 3,
  kitchenClients: 2,
  serviceClients: 1,
  managerClients: 0,
  stockClients: 0,
  clientsWithErrors: 0,
  totalErrors: 0,
  totalSuccessfulSends: 128,
  totalFailedSends: 0,
  clientDetails: {},
  recentErrors: [],
  recentLogs: [],
  timestamp: '2026-07-12T10:00:00.000Z',
};

type DiagnosticsProps = ComponentProps<typeof CashierDiagnostics>;

function renderDiagnostics(overrides: Partial<DiagnosticsProps> = {}) {
  const props: DiagnosticsProps = {
    sseConnected: true,
    sseConnectionState: 'connected',
    sseLastEventTime: null,
    sseError: null,
    audioEnabled: true,
    audioReady: true,
    audioBlockedByPolicy: false,
    onTestSound: jest.fn(),
    onEnableAudio: jest.fn(),
    onRefreshConnection: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
  return render(<CashierDiagnostics {...props} />);
}

// Flush the mount fetch (default: resolves sampleDiagnostics) inside act so
// no state update escapes the test scope.
const flushServerFetch = () => screen.findByText('Total Clients');

describe('CashierDiagnostics', () => {
  beforeEach(() => {
    mockGetEventsDiagnostics.mockReset();
    mockGetEventsDiagnostics.mockResolvedValue(sampleDiagnostics);
  });

  it('renders the SSE connection status and the last-activity text', async () => {
    renderDiagnostics({ sseConnectionState: 'connected', sseLastEventTime: null });
    // The status badge renders the raw connection state; "Never" is the
    // last-activity string when there is no recorded event time.
    expect(screen.getByText('connected')).toBeInTheDocument();
    expect(screen.getByText('Never')).toBeInTheDocument();
    await flushServerFetch();
  });

  it('shows the SSE error text when sseError is provided', async () => {
    renderDiagnostics({ sseError: 'Stream disconnected' });
    expect(screen.getByText('Stream disconnected')).toBeInTheDocument();
    await flushServerFetch();
  });

  it('hides the SSE error box when sseError is null', async () => {
    renderDiagnostics({ sseError: null });
    expect(screen.queryByText('Stream disconnected')).not.toBeInTheDocument();
    await flushServerFetch();
  });

  it('disables the Test Sound button when audio is not ready', async () => {
    renderDiagnostics({ audioReady: false });
    expect(screen.getByRole('button', { name: 'test_sound' })).toBeDisabled();
    await flushServerFetch();
  });

  it('enables the Test Sound button when audio is ready', async () => {
    renderDiagnostics({ audioReady: true });
    expect(screen.getByRole('button', { name: 'test_sound' })).toBeEnabled();
    await flushServerFetch();
  });

  it('shows the Enable Sound button only when audio is blocked by policy', async () => {
    const { unmount } = renderDiagnostics({ audioBlockedByPolicy: false });
    expect(screen.queryByRole('button', { name: 'enable_sound' })).not.toBeInTheDocument();
    await flushServerFetch();
    unmount();

    renderDiagnostics({ audioBlockedByPolicy: true });
    expect(screen.getByRole('button', { name: 'enable_sound' })).toBeInTheDocument();
    await flushServerFetch();
  });

  it('renders the tips box when audio is blocked by policy', async () => {
    renderDiagnostics({ audioBlockedByPolicy: true, sseConnectionState: 'connected' });
    expect(screen.getByText('tips')).toBeInTheDocument();
    await flushServerFetch();
  });

  it('renders the tips box when the SSE connection is in the error state', async () => {
    renderDiagnostics({ audioBlockedByPolicy: false, sseConnectionState: 'error' });
    expect(screen.getByText('tips')).toBeInTheDocument();
    await flushServerFetch();
  });

  it('does not render the tips box when audio is ok and the connection is not in error', async () => {
    renderDiagnostics({ audioBlockedByPolicy: false, sseConnectionState: 'connected' });
    expect(screen.queryByText('tips')).not.toBeInTheDocument();
    await flushServerFetch();
  });

  it('renders server diagnostics totals after the mount fetch resolves', async () => {
    mockGetEventsDiagnostics.mockResolvedValue(sampleDiagnostics);
    renderDiagnostics();
    expect(await screen.findByText('Total Clients')).toBeInTheDocument();
    expect(screen.getByText('Successful Sends')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(mockGetEventsDiagnostics).toHaveBeenCalledTimes(1);
  });

  it('renders the server error box when the mount fetch rejects', async () => {
    mockGetEventsDiagnostics.mockReset();
    mockGetEventsDiagnostics.mockRejectedValue(new Error('diagnostics unavailable'));
    renderDiagnostics();
    expect(await screen.findByText('diagnostics unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Total Clients')).not.toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = jest.fn();
    renderDiagnostics({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await flushServerFetch();
  });
});
