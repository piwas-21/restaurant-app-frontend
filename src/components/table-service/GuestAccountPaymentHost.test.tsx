import { I18nextProvider } from 'react-i18next';
import { act, render, screen, waitFor } from '@testing-library/react';
import i18n from '../../i18n';
import { useTableGuestFeature } from '@/contexts/TableGuestFeatureContext';
import { useTableGuestVisit } from '@/contexts/TableGuestVisitContext';
import { loadTableGuestPaymentLocale } from '@/services/tableGuestPaymentLocaleService';
import { hasGuestAccountPaymentRecovery } from '@/services/guestAccountPaymentStorage';
import { readStoredTableGuestState } from '@/services/tableGuestVisitStorage';
import { stripGuestPaymentReturnFromUrl } from '@/lib/guestPaymentReturn';
import { GUEST_PAYMENT_RECOVERY_CHANGED } from '@/lib/guestPaymentRecoverySignal';
import GuestAccountPaymentHost from './GuestAccountPaymentHost';

jest.mock('@/contexts/TableGuestFeatureContext', () => ({ useTableGuestFeature: jest.fn() }));
jest.mock('@/contexts/TableGuestVisitContext', () => ({ useTableGuestVisit: jest.fn() }));
jest.mock('@/services/tableGuestPaymentLocaleService', () => ({ loadTableGuestPaymentLocale: jest.fn() }));
jest.mock('@/services/guestAccountPaymentStorage', () => ({ hasGuestAccountPaymentRecovery: jest.fn() }));
jest.mock('@/services/tableGuestVisitStorage', () => ({ readStoredTableGuestState: jest.fn() }));
jest.mock('@/lib/guestPaymentReturn', () => ({
  stripGuestPaymentReturnFromUrl: jest.fn(() => ({ attemptId: null, canceled: false, present: false })),
}));
jest.mock('./GuestAccountPaymentPanel', () => ({
  __esModule: true,
  default: (props: {
    newPaymentsEnabled: boolean;
    canCreatePayment: boolean;
    recoveryIdentity: { serviceSessionId: string } | null;
  }) => (
    <div
      data-testid="guest-payment-panel"
      data-enabled={String(props.newPaymentsEnabled)}
      data-can-create={String(props.canCreatePayment)}
      data-recovery-session={props.recoveryIdentity?.serviceSessionId ?? ''}
    />
  ),
}));

const identity = {
  serviceSessionId: '00000000-0000-4000-8000-000000000001',
  participantToken: 'participant-secret',
  expiresAt: '2030-01-01T00:00:00Z',
};

function renderHost() {
  return render(
    <I18nextProvider i18n={i18n}>
      <GuestAccountPaymentHost tableAccount={null} onAccountUpdated={jest.fn()} />
    </I18nextProvider>,
  );
}

describe('GuestAccountPaymentHost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(loadTableGuestPaymentLocale).mockResolvedValue();
    jest.mocked(hasGuestAccountPaymentRecovery).mockReturnValue(false);
    jest.mocked(readStoredTableGuestState).mockReturnValue({ kind: 'none' });
    jest.mocked(stripGuestPaymentReturnFromUrl).mockReturnValue({ attemptId: null, canceled: false, present: false });
    jest.mocked(useTableGuestFeature).mockReturnValue({
      tableGuestVisitsV1: true,
      tableAccountPaymentsV1: false,
      tableGuestAccountPaymentsV1: false,
      tableGuestFeatureStatus: 'ready',
      hasStoredGuestState: false,
      retryVersion: 0,
      retryTableGuestFeature: jest.fn(),
    });
    jest.mocked(useTableGuestVisit).mockReturnValue({
      phase: 'notJoined',
      visit: null,
      featureEnabled: true,
      featureStatus: 'ready',
      pendingRound: null,
      pendingRoundStatus: 'known',
      requiresSafeDeparture: false,
    } as ReturnType<typeof useTableGuestVisit>);
  });

  it('does not import payment strings or panel when rollout is off and the tab has no pending attempt', async () => {
    renderHost();

    await waitFor(() => expect(screen.queryByTestId('guest-payment-panel')).not.toBeInTheDocument());
    expect(loadTableGuestPaymentLocale).not.toHaveBeenCalled();
    expect(hasGuestAccountPaymentRecovery).toHaveBeenCalled();
  });

  it('does not let a return query hint alone wake payment code when no owner descriptor exists', async () => {
    jest.mocked(stripGuestPaymentReturnFromUrl).mockReturnValue({
      attemptId: '00000000-0000-4000-8000-000000000020',
      canceled: true,
      present: true,
    });

    renderHost();

    await waitFor(() => expect(screen.queryByTestId('guest-payment-panel')).not.toBeInTheDocument());
    expect(loadTableGuestPaymentLocale).not.toHaveBeenCalled();
  });

  it('loads payment strings and exposes new writes only after all required flags are true', async () => {
    jest.mocked(useTableGuestFeature).mockReturnValue({
      tableGuestVisitsV1: true,
      tableAccountPaymentsV1: true,
      tableGuestAccountPaymentsV1: true,
      tableGuestFeatureStatus: 'ready',
      hasStoredGuestState: true,
      retryVersion: 0,
      retryTableGuestFeature: jest.fn(),
    });
    jest.mocked(useTableGuestVisit).mockReturnValue({
      phase: 'active',
      visit: identity,
      featureEnabled: true,
      featureStatus: 'ready',
      pendingRound: null,
      pendingRoundStatus: 'known',
      requiresSafeDeparture: false,
    } as ReturnType<typeof useTableGuestVisit>);

    renderHost();

    const panel = await screen.findByTestId('guest-payment-panel');
    expect(panel).toHaveAttribute('data-enabled', 'true');
    expect(panel).toHaveAttribute('data-can-create', 'true');
    await waitFor(() => expect(loadTableGuestPaymentLocale).toHaveBeenCalledTimes(1));
  });

  it('keeps saved owner recovery available when new-payment rollout is off on an ended visit', async () => {
    jest.mocked(hasGuestAccountPaymentRecovery).mockReturnValue(true);
    jest.mocked(readStoredTableGuestState).mockReturnValue({ kind: 'visit', identity });
    jest.mocked(useTableGuestVisit).mockReturnValue({
      phase: 'ended',
      visit: null,
      featureEnabled: true,
      featureStatus: 'ready',
      pendingRound: null,
      pendingRoundStatus: 'known',
      requiresSafeDeparture: true,
    } as ReturnType<typeof useTableGuestVisit>);

    renderHost();

    const panel = await screen.findByTestId('guest-payment-panel');
    expect(panel).toHaveAttribute('data-enabled', 'false');
    expect(panel).toHaveAttribute('data-can-create', 'false');
    expect(panel).toHaveAttribute('data-recovery-session', identity.serviceSessionId);
    expect(loadTableGuestPaymentLocale).toHaveBeenCalledTimes(1);
  });

  it('keeps the panel mounted if an unresolved request is saved while the feature flag is off', async () => {
    renderHost();
    await waitFor(() => expect(screen.queryByTestId('guest-payment-panel')).not.toBeInTheDocument());
    jest.mocked(hasGuestAccountPaymentRecovery).mockReturnValue(true);

    act(() => window.dispatchEvent(new Event(GUEST_PAYMENT_RECOVERY_CHANGED)));

    const panel = await screen.findByTestId('guest-payment-panel');
    expect(panel).toHaveAttribute('data-enabled', 'false');
    expect(loadTableGuestPaymentLocale).toHaveBeenCalledTimes(1);
  });
});
