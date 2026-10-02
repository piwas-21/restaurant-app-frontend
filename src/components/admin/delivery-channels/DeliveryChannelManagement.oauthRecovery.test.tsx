import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DeliveryChannelManagement from './DeliveryChannelManagement';
import { deliveryChannelManagementService } from '@/services/deliveryChannelManagementService';
import type { DeliveryChannelManagementSummary } from '@/types/deliveryChannelManagement';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
jest.mock('@/hooks/admin/useDeliveryChannelCatalogue', () => ({
  useDeliveryChannelCatalogue: () => ({ catalogue: null, dirty: false, stale: false, busy: null, refresh: jest.fn() }),
}));
jest.mock('@/hooks/admin/useDeliveryChannelPublication', () => ({
  useDeliveryChannelPublication: () => ({ verified: false }),
}));
jest.mock('./DeliveryChannelExceptionInbox', () => () => null);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

const notConnected: DeliveryChannelManagementSummary = {
  provider: 'uber-eats',
  enabled: true,
  sandboxOnly: true,
  connectionStatus: 'notConnected',
  healthStatus: 'unknown',
  storeId: 'store-1',
  currency: 'EUR',
  storeConfirmed: false,
  storeDisplayName: 'Sofra Sandbox',
  integrationEnabled: false,
  isOrderManager: false,
  pendingMerchantActivation: false,
  requireManualAcceptance: true,
  paused: false,
  checkedAt: '2026-10-02T12:00:00Z',
  degradedReason: null,
  latestPublication: null,
  capabilities: {
    supportsSimpleItems: true,
    supportsVariations: true,
    supportsModifiers: false,
    supportsBundles: false,
    supportsItemAvailability: true,
    supportsStoreHoursEditing: false,
    supportsAutomaticAcceptance: true,
  },
};

afterEach(() => jest.restoreAllMocks());

it('keeps a lost OAuth start locked until the latest post-start status read completes', async () => {
  const oldRead = deferred<DeliveryChannelManagementSummary>();
  const freshRead = deferred<DeliveryChannelManagementSummary>();
  const latestRead = deferred<DeliveryChannelManagementSummary>();
  const getSummary = jest
    .spyOn(deliveryChannelManagementService, 'getSummary')
    .mockResolvedValueOnce(notConnected)
    .mockReturnValueOnce(oldRead.promise)
    .mockReturnValueOnce(freshRead.promise)
    .mockReturnValueOnce(latestRead.promise);
  jest.spyOn(deliveryChannelManagementService, 'getAvailability').mockResolvedValue({
    enabled: true,
    paused: false,
    pausedUntil: null,
    checkedAt: '2026-10-02T12:00:00Z',
    storeStatus: 'unknown',
    items: [],
  });
  jest
    .spyOn(deliveryChannelManagementService, 'getExceptions')
    .mockResolvedValue({ items: [], nextCursor: null, checkedAt: '2026-10-02T12:00:00Z' });
  const start = jest
    .spyOn(deliveryChannelManagementService, 'startOAuth')
    .mockRejectedValue(new Error('Lost response'));
  render(<DeliveryChannelManagement />);
  const startButton = await screen.findByRole('button', { name: 'deliveryChannels.connection.start' });

  fireEvent.click(screen.getByRole('button', { name: 'deliveryChannels.refresh' }));
  await waitFor(() => expect(getSummary).toHaveBeenCalledTimes(2));
  fireEvent.click(startButton);
  await screen.findByText('deliveryChannels.connection.errors.uncertain');
  expect(startButton).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'deliveryChannels.refreshStatus' }));

  await act(async () => {
    oldRead.resolve(notConnected);
    await Promise.resolve();
  });
  expect(startButton).toBeDisabled();
  expect(start).toHaveBeenCalledTimes(1);
  expect(getSummary).toHaveBeenCalledTimes(3);

  fireEvent.click(screen.getByRole('button', { name: 'deliveryChannels.refreshStatus' }));
  expect(getSummary).toHaveBeenCalledTimes(4);
  await act(async () => {
    freshRead.resolve(notConnected);
    await Promise.resolve();
  });
  expect(startButton).toBeDisabled();

  await act(async () => {
    latestRead.resolve({ ...notConnected, connectionStatus: 'authorizing', pendingMerchantActivation: true });
    await Promise.resolve();
  });
  expect(await screen.findByText('deliveryChannels.connection.authorizationPending')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'deliveryChannels.connection.start' })).not.toBeInTheDocument();
  expect(start).toHaveBeenCalledTimes(1);
});
