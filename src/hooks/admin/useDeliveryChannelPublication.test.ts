import { act, renderHook } from '@testing-library/react';
import { ApiError } from '@/utils/apiClient';
import { deliveryChannelManagementService } from '@/services/deliveryChannelManagementService';
import type {
  DeliveryChannelCatalogue,
  DeliveryChannelPreview,
  DeliveryChannelPublication,
} from '@/types/deliveryChannelCatalogue';
import { useDeliveryChannelPublication } from './useDeliveryChannelPublication';

const mockTranslate = (key: string) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));

const catalogue: DeliveryChannelCatalogue = {
  storeId: 'store-1',
  currency: 'EUR',
  mappingRevision: 'mapping-1',
  draftRevision: 'draft-1',
  sourceRevision: 'source-1',
  canPublish: false,
  items: [],
  serviceAvailability: [],
  serviceHoursEditable: false,
  serviceHoursStatus: 'reviewedTemplate',
  currentServiceAvailability: [],
  currentServiceHoursStatus: 'unknown',
  blockingCodes: [],
  warningCodes: [],
  latestPublication: null,
};

const preview: DeliveryChannelPreview = {
  draftRevision: 'draft-1',
  mappingRevision: 'mapping-1',
  sourceRevision: 'source-1',
  publicationRevision: 'publish-1',
  currency: 'EUR',
  canPublish: true,
  items: [],
  serviceAvailability: [],
  serviceHoursEditable: false,
  serviceHoursStatus: 'reviewedTemplate',
  currentServiceAvailability: [],
  currentServiceHoursStatus: 'unknown',
  blockingCodes: [],
  warningCodes: [],
};

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useDeliveryChannelPublication', () => {
  it('keeps an uncertain publish locked and never sends a duplicate request', async () => {
    jest.spyOn(deliveryChannelManagementService, 'preview').mockResolvedValue(preview);
    const publish = jest
      .spyOn(deliveryChannelManagementService, 'publish')
      .mockRejectedValue(new ApiError(503, 'response lost'));
    const refreshCatalogue = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useDeliveryChannelPublication({
        catalogue,
        selectionVersion: 0,
        dirty: false,
        stale: false,
        draftWriteUncertain: false,
        refreshCatalogue,
      }),
    );

    await act(async () => {
      await result.current.createPreview();
    });
    expect(result.current.canPublish).toBe(true);
    await act(async () => {
      await result.current.publish();
    });

    expect(result.current.writeUncertain).toBe(true);
    expect(result.current.canPublish).toBe(false);
    expect(refreshCatalogue).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.publish();
    });
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('checks the new pending publication when the catalogue still has an older terminal publication', async () => {
    jest.useFakeTimers();
    const oldPublication: DeliveryChannelPublication = {
      id: 'old-publication',
      mappingRevision: 'mapping-old',
      publicationRevision: 'publication-old',
      sourceRevision: 'source-old',
      state: 'verified',
      providerReadbackVerified: true,
      providerMenuHash: 'old-hash',
      verifiedAt: '2026-10-01T10:00:00Z',
      resultCode: null,
    };
    const newPending: DeliveryChannelPublication = {
      ...oldPublication,
      id: 'new-publication',
      mappingRevision: 'mapping-new',
      publicationRevision: 'publication-new',
      sourceRevision: 'source-new',
      state: 'pending',
      providerReadbackVerified: false,
      providerMenuHash: null,
      verifiedAt: null,
    };
    const newVerified = { ...newPending, state: 'verified' as const, providerReadbackVerified: true };
    const oldCatalogue = {
      ...catalogue,
      latestPublication: {
        id: oldPublication.id,
        mappingRevision: oldPublication.mappingRevision,
        publicationRevision: oldPublication.publicationRevision,
        state: oldPublication.state,
        verifiedAt: oldPublication.verifiedAt,
        resultCode: null,
      },
    };
    let getNewCalls = 0;
    jest.spyOn(deliveryChannelManagementService, 'getPublication').mockImplementation(async (id) => {
      if (id === oldPublication.id) return oldPublication;
      return getNewCalls++ === 0 ? newPending : newVerified;
    });
    jest.spyOn(deliveryChannelManagementService, 'publish').mockResolvedValue(newPending);
    jest.spyOn(deliveryChannelManagementService, 'preview').mockResolvedValue(preview);
    const refreshCatalogue = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useDeliveryChannelPublication({
        catalogue: oldCatalogue,
        selectionVersion: 0,
        dirty: false,
        stale: false,
        draftWriteUncertain: false,
        refreshCatalogue,
      }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(deliveryChannelManagementService.getPublication).toHaveBeenCalledWith('old-publication');
    await act(async () => {
      await result.current.createPreview();
    });

    let publishPromise!: Promise<DeliveryChannelPublication | null>;
    act(() => {
      publishPromise = result.current.publish();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.publication?.id).toBe('new-publication');

    await act(async () => {
      await result.current.refreshPublication();
    });
    expect(deliveryChannelManagementService.getPublication).toHaveBeenLastCalledWith('new-publication');
    expect(result.current.publication?.state).toBe('pending');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2_000);
      await publishPromise;
    });
    expect(result.current.publication?.id).toBe('new-publication');
    expect(result.current.publication?.providerReadbackVerified).toBe(true);
  });
});
