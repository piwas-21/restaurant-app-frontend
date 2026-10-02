import { act, renderHook, waitFor } from '@testing-library/react';
import { deliveryChannelManagementService } from '@/services/deliveryChannelManagementService';
import type { DeliveryChannelAvailability, DeliveryChannelManagementSummary } from '@/types/deliveryChannelManagement';
import { useDeliveryChannelOperations } from './useDeliveryChannelOperations';
import { useDeliveryChannelOverview } from './useDeliveryChannelOverview';

const mockTranslate = (key: string) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function summary(paused: boolean, checkedAt: string): DeliveryChannelManagementSummary {
  return {
    provider: 'uber-eats',
    enabled: true,
    sandboxOnly: true,
    connectionStatus: 'connected',
    healthStatus: 'healthy',
    storeId: 'store-1',
    currency: 'EUR',
    storeConfirmed: true,
    storeDisplayName: 'Sofra Sandbox',
    integrationEnabled: true,
    isOrderManager: true,
    pendingMerchantActivation: false,
    requireManualAcceptance: false,
    paused,
    checkedAt,
    degradedReason: null,
    capabilities: {
      supportsSimpleItems: true,
      supportsVariations: true,
      supportsModifiers: false,
      supportsBundles: false,
      supportsItemAvailability: true,
      supportsStoreHoursEditing: false,
      supportsAutomaticAcceptance: true,
    },
    latestPublication: null,
  };
}

function availability(paused: boolean, checkedAt: string): DeliveryChannelAvailability {
  return { enabled: true, paused, pausedUntil: null, checkedAt, storeStatus: paused ? 'PAUSED' : 'ONLINE', items: [] };
}

afterEach(() => jest.restoreAllMocks());

it('forces a fresh post-write read and only clears the uncertain lock from the latest read', async () => {
  const oldSummary = deferred<DeliveryChannelManagementSummary>();
  const oldAvailability = deferred<DeliveryChannelAvailability>();
  const confirmationSummary = deferred<DeliveryChannelManagementSummary>();
  const confirmationAvailability = deferred<DeliveryChannelAvailability>();
  const postPause = summary(true, '2026-10-02T10:01:00Z');
  const postPauseAvailability = availability(true, '2026-10-02T10:01:00Z');
  const confirmed = summary(true, '2026-10-02T10:02:00Z');
  const confirmedAvailability = availability(true, '2026-10-02T10:02:00Z');
  let summaryCall = 0;
  let availabilityCall = 0;
  jest.spyOn(deliveryChannelManagementService, 'getSummary').mockImplementation(() => {
    summaryCall += 1;
    if (summaryCall === 1) return oldSummary.promise;
    if (summaryCall === 2) return Promise.resolve(postPause);
    return confirmationSummary.promise;
  });
  jest.spyOn(deliveryChannelManagementService, 'getAvailability').mockImplementation(() => {
    availabilityCall += 1;
    if (availabilityCall === 1) return oldAvailability.promise;
    if (availabilityCall === 2) return Promise.resolve(postPauseAvailability);
    return confirmationAvailability.promise;
  });
  jest.spyOn(deliveryChannelManagementService, 'getExceptions').mockResolvedValue({
    items: [],
    nextCursor: null,
    checkedAt: '2026-10-02T10:00:00Z',
  });
  jest.spyOn(deliveryChannelManagementService, 'pauseAvailability').mockResolvedValue({
    state: 'uncertain',
    effectiveUntil: null,
    providerConfirmed: false,
    resultCode: 'AvailabilityConfirmationPending',
  });

  const { result } = renderHook(() => {
    const overview = useDeliveryChannelOverview();
    const operations = useDeliveryChannelOperations(overview.refresh);
    return { overview, operations };
  });
  await waitFor(() => expect(summaryCall).toBe(1));

  await act(async () => {
    await result.current.operations.pause(30);
  });
  expect(summaryCall).toBe(2);
  expect(result.current.operations.statusCheckRequired).toBe(true);
  expect(result.current.overview.summary).toEqual(postPause);

  let explicitRead!: Promise<boolean>;
  act(() => {
    explicitRead = result.current.operations.readStatus();
  });
  await waitFor(() => expect(summaryCall).toBe(3));
  expect(result.current.operations.statusCheckRequired).toBe(true);

  await act(async () => {
    oldSummary.resolve(summary(false, '2026-10-02T09:59:00Z'));
    oldAvailability.resolve(availability(false, '2026-10-02T09:59:00Z'));
    await Promise.resolve();
  });
  expect(result.current.overview.summary).toEqual(postPause);
  expect(result.current.operations.statusCheckRequired).toBe(true);

  await act(async () => {
    confirmationSummary.resolve(confirmed);
    confirmationAvailability.resolve(confirmedAvailability);
    expect(await explicitRead).toBe(true);
  });
  expect(result.current.overview.summary).toEqual(confirmed);
  expect(result.current.operations.statusCheckRequired).toBe(false);
});
