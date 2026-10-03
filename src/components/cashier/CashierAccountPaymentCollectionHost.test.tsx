import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TenantFeaturesProvider } from '@/contexts/TenantFeaturesContext';
import { persistPendingAccountPayment, readPendingAccountPayment } from '@/lib/pendingAccountPayment';
import { loadAccountPaymentCollection } from './accountPaymentCollectionLoader';
import { loadAccountPaymentLocale } from '@/services/accountPaymentLocaleService';
import type { TableServiceSessionDto } from '@/types/order';
import CashierAccountPaymentCollectionHost from './CashierAccountPaymentCollectionHost';

const actorId = '3b241101-e2bb-4255-8caf-4136c566a962';
const otherActorId = '9f8b7c6d-5e4f-4321-9876-0123456789ab';
const serviceSessionId = 'ba1e1d7b-7f1d-4a36-8a4f-a6e06a27d281';
const operationId = 'b90d31c6-bec4-443f-a9ec-25bb070ed4f4';
const nextServiceSessionId = '78ef9452-1e58-4112-b1de-b0dd06a0e186';
const session = { serviceSessionId } as TableServiceSessionDto;
const mockUseState = useState;
const mockApiGet = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('@/components/AuthContext', () => ({
  useOptionalAuth: () => mockUseOptionalAuth(),
}));

jest.mock('@/utils/apiClient', () => ({ apiClient: { get: (...args: unknown[]) => mockApiGet(...args) } }));

jest.mock('@/services/accountPaymentLocaleService', () => ({
  loadAccountPaymentLocale: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./accountPaymentCollectionLoader', () => ({
  loadAccountPaymentCollection: jest.fn(() =>
    Promise.resolve({
      default: ({
        actorId: currentActorId,
        session: currentSession,
        enabled,
        disabled,
        recoveryEnabled,
      }: {
        actorId: string;
        session: TableServiceSessionDto;
        enabled: boolean;
        disabled: boolean;
        recoveryEnabled: boolean;
      }) => {
        const [mountedIdentity] = mockUseState(`${currentActorId}:${currentSession.serviceSessionId}`);
        return (
          <output data-testid="account-payment-collection">
            {`${mountedIdentity}|${String(enabled)}:${String(disabled)}:${String(recoveryEnabled)}`}
          </output>
        );
      },
    }),
  ),
}));

const mockUseOptionalAuth = jest.fn();

function oldAuthUser() {
  return { user: { role: 'Cashier', email: 'not-an-identity@example.com' }, isLoading: false };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function fallback() {
  return <div data-testid="legacy-collection">Legacy tender form</div>;
}

function renderHost(enabled: boolean, disabled = false, recoveryEnabled = true) {
  return render(
    <TenantFeaturesProvider features={{ tableAccountPaymentsV1: enabled }}>
      <CashierAccountPaymentCollectionHost
        session={session}
        disabled={disabled}
        recoveryEnabled={recoveryEnabled}
        onUpdated={jest.fn()}
        fallback={fallback()}
      />
    </TenantFeaturesProvider>,
  );
}

function savePending(actor: string) {
  return persistPendingAccountPayment({
    actorId: actor,
    serviceSessionId,
    kind: 'payment',
    stage: 'review',
    expectedVersion: 1,
    request: {
      operationId,
      expectedAccountRevision: 2,
      mode: 'Amount',
      paymentMethod: 'Cash',
      amountMinor: 500,
    },
  });
}

describe('CashierAccountPaymentCollectionHost', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mockUseOptionalAuth.mockReturnValue({ user: { userId: actorId }, isLoading: false });
    mockApiGet.mockReset();
    jest.mocked(loadAccountPaymentLocale).mockReset().mockResolvedValue(undefined);
    jest.mocked(loadAccountPaymentCollection).mockClear();
  });

  afterEach(() => jest.restoreAllMocks());

  it('keeps the legacy cashier tender dormant without loading account code or translations', async () => {
    renderHost(false);

    expect(await screen.findByTestId('legacy-collection')).toBeInTheDocument();
    expect(loadAccountPaymentLocale).not.toHaveBeenCalled();
    expect(loadAccountPaymentCollection).not.toHaveBeenCalled();
  });

  it('loads the collection and sidecar only after the feature is enabled', async () => {
    renderHost(true);

    expect(await screen.findByTestId('account-payment-collection')).toHaveTextContent('true:false:true');
    expect(loadAccountPaymentLocale).toHaveBeenCalledTimes(1);
    expect(loadAccountPaymentCollection).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('legacy-collection')).not.toBeInTheDocument();
  });

  it('mounts same-actor recovery read-only when collection is switched off', async () => {
    expect(savePending(actorId)).toBe(true);
    renderHost(false);

    expect(await screen.findByTestId('account-payment-collection')).toHaveTextContent('false:true:true');
    expect(loadAccountPaymentLocale).toHaveBeenCalledTimes(1);
    expect(loadAccountPaymentCollection).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('legacy-collection')).not.toBeInTheDocument();
  });

  it('remounts account state when actor or visit changes and leaves the old recovery record intact', async () => {
    expect(savePending(actorId)).toBe(true);
    const view = renderHost(true);
    expect(await screen.findByTestId('account-payment-collection')).toHaveTextContent(
      `${actorId}:${serviceSessionId}|true:false:true`,
    );

    mockUseOptionalAuth.mockReturnValue({ user: { userId: otherActorId }, isLoading: false });
    view.rerender(
      <TenantFeaturesProvider features={{ tableAccountPaymentsV1: true }}>
        <CashierAccountPaymentCollectionHost
          session={session}
          disabled={false}
          recoveryEnabled={true}
          onUpdated={jest.fn()}
          fallback={fallback()}
        />
      </TenantFeaturesProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('account-payment-collection')).toHaveTextContent(
        `${otherActorId}:${serviceSessionId}|true:false:true`,
      ),
    );
    expect(readPendingAccountPayment(actorId, serviceSessionId)).toMatchObject({ status: 'pending' });

    view.rerender(
      <TenantFeaturesProvider features={{ tableAccountPaymentsV1: true }}>
        <CashierAccountPaymentCollectionHost
          session={{ serviceSessionId: nextServiceSessionId } as TableServiceSessionDto}
          disabled={false}
          recoveryEnabled={true}
          onUpdated={jest.fn()}
          fallback={fallback()}
        />
      </TenantFeaturesProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('account-payment-collection')).toHaveTextContent(
        `${otherActorId}:${nextServiceSessionId}|true:false:true`,
      ),
    );
    expect(readPendingAccountPayment(actorId, serviceSessionId)).toMatchObject({ status: 'pending' });
  });

  it('does not recover another actor’s pending operation', async () => {
    expect(savePending(otherActorId)).toBe(true);
    renderHost(false);

    expect(await screen.findByTestId('legacy-collection')).toBeInTheDocument();
    expect(loadAccountPaymentLocale).not.toHaveBeenCalled();
    expect(loadAccountPaymentCollection).not.toHaveBeenCalled();
  });

  it('resolves an old auth record before permitting the feature-off legacy collection', async () => {
    mockUseOptionalAuth.mockReturnValue(oldAuthUser());
    mockApiGet.mockResolvedValue({ success: true, data: { id: actorId } });

    renderHost(false);

    expect(await screen.findByTestId('legacy-collection')).toBeInTheDocument();
    expect(mockApiGet).toHaveBeenCalledWith('/api/User/profile', {
      requireAuth: true,
      signOutOn401: false,
    });
    expect(loadAccountPaymentLocale).not.toHaveBeenCalled();
    expect(loadAccountPaymentCollection).not.toHaveBeenCalled();
  });

  it('recovers only the profile-resolved actor’s pending operation while the feature is off', async () => {
    expect(savePending(actorId)).toBe(true);
    mockUseOptionalAuth.mockReturnValue(oldAuthUser());
    mockApiGet.mockResolvedValue({ success: true, data: { id: actorId } });

    renderHost(false);

    expect(await screen.findByTestId('account-payment-collection')).toHaveTextContent('false:true:true');
    expect(screen.queryByTestId('legacy-collection')).not.toBeInTheDocument();
    expect(loadAccountPaymentCollection).toHaveBeenCalledTimes(1);
  });

  it('keeps both fallback and recovery blocked while identity resolution is pending', async () => {
    expect(savePending(actorId)).toBe(true);
    mockUseOptionalAuth.mockReturnValue(oldAuthUser());
    const profile = deferred<{ success: boolean; data: { id: string } }>();
    mockApiGet.mockReturnValue(profile.promise);

    renderHost(false);

    expect(await screen.findByText('cashier.tables.operation_checking')).toBeInTheDocument();
    expect(screen.queryByTestId('legacy-collection')).not.toBeInTheDocument();
    expect(screen.queryByTestId('account-payment-collection')).not.toBeInTheDocument();
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(1));
    profile.resolve({ success: true, data: { id: actorId } });
    expect(await screen.findByTestId('account-payment-collection')).toHaveTextContent('false:true:true');
  });

  it('does not mount stale actor recovery after auth changes while the old profile request is in flight', async () => {
    expect(savePending(actorId)).toBe(true);
    const oldAuth = oldAuthUser();
    let currentAuth = oldAuth;
    mockUseOptionalAuth.mockImplementation(() => currentAuth);
    const oldProfile = deferred<{ success: boolean; data: { id: string } }>();
    mockApiGet
      .mockImplementationOnce(() => oldProfile.promise)
      .mockResolvedValueOnce({
        success: true,
        data: { id: otherActorId },
      });
    const view = renderHost(false);
    expect(await screen.findByText('cashier.tables.operation_checking')).toBeInTheDocument();

    currentAuth = oldAuthUser();
    view.rerender(
      <TenantFeaturesProvider features={{ tableAccountPaymentsV1: false }}>
        <CashierAccountPaymentCollectionHost
          session={session}
          disabled={false}
          recoveryEnabled={true}
          onUpdated={jest.fn()}
          fallback={fallback()}
        />
      </TenantFeaturesProvider>,
    );

    expect(await screen.findByTestId('legacy-collection')).toBeInTheDocument();
    oldProfile.resolve({ success: true, data: { id: actorId } });
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('account-payment-collection')).not.toBeInTheDocument();
    expect(readPendingAccountPayment(actorId, serviceSessionId)).toMatchObject({ status: 'pending' });
  });

  it('offers retry on a failed old-session identity lookup without clearing auth or using legacy collection', async () => {
    mockUseOptionalAuth.mockReturnValue(oldAuthUser());
    mockApiGet
      .mockRejectedValueOnce(new Error('private profile response'))
      .mockResolvedValueOnce({ success: true, data: { id: actorId } });
    renderHost(false);

    expect(await screen.findByRole('alert')).toHaveTextContent('cashier.tables.load_error');
    expect(screen.queryByTestId('legacy-collection')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'cashier.tables.retry' }));

    expect(await screen.findByTestId('legacy-collection')).toBeInTheDocument();
    expect(mockUseOptionalAuth()).toEqual(oldAuthUser());
  });

  it('treats unreadable recovery storage as read-only recovery instead of enabling legacy collection', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    renderHost(false);

    expect(await screen.findByTestId('account-payment-collection')).toHaveTextContent('false:true:true');
    expect(screen.queryByTestId('legacy-collection')).not.toBeInTheDocument();
    expect(loadAccountPaymentCollection).toHaveBeenCalledTimes(1);
  });

  it('blocks and offers a localized base retry when a lazy resource fails', async () => {
    jest.mocked(loadAccountPaymentLocale).mockRejectedValueOnce(new Error('chunk unavailable'));
    renderHost(true);

    expect(await screen.findByRole('alert')).toHaveTextContent('cashier.tables.load_error');
    fireEvent.click(screen.getByRole('button', { name: 'cashier.tables.retry' }));

    expect(await screen.findByTestId('account-payment-collection')).toHaveTextContent('true:false:true');
    await waitFor(() => expect(loadAccountPaymentLocale).toHaveBeenCalledTimes(2));
    expect(loadAccountPaymentCollection).toHaveBeenCalledTimes(2);
  });

  it('fails closed if the authenticated actor identity is unavailable', async () => {
    mockUseOptionalAuth.mockReturnValue({ user: { role: 'Cashier' }, isLoading: false });
    renderHost(false);

    expect(await screen.findByRole('alert')).toHaveTextContent('cashier.tables.load_error');
    expect(screen.queryByTestId('legacy-collection')).not.toBeInTheDocument();
    expect(loadAccountPaymentLocale).not.toHaveBeenCalled();
    expect(loadAccountPaymentCollection).not.toHaveBeenCalled();
  });
});
