import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@/utils/apiClient';
import { deliveryChannelManagementService } from '@/services/deliveryChannelManagementService';
import type { DeliveryChannelCatalogue, DeliveryChannelCatalogueDraft } from '@/types/deliveryChannelCatalogue';
import { candidateIdentity, useDeliveryChannelCatalogue } from './useDeliveryChannelCatalogue';

const mockTranslate = (key: string) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));

const item = {
  providerItemId: 'uber-item-1',
  providerItemName: 'Soup',
  productId: 'product-1',
  variationId: null,
  productName: 'Soup',
  variationName: null,
  tenantPriceMinor: 500,
  providerPriceMinor: 500,
  providerPriceStatus: 'currentReadback' as const,
  currency: 'EUR',
  available: true,
  mappingStatus: 'mapped' as const,
  blockReason: null,
};

const initialCatalogue: DeliveryChannelCatalogue = {
  storeId: 'store-1',
  currency: 'EUR',
  mappingRevision: 'mapping-0',
  draftRevision: '',
  sourceRevision: 'source-1',
  canPublish: false,
  items: [item],
  serviceAvailability: [],
  serviceHoursEditable: false,
  serviceHoursStatus: 'reviewedTemplate',
  currentServiceAvailability: [],
  currentServiceHoursStatus: 'unknown',
  blockingCodes: [],
  warningCodes: [],
  latestPublication: null,
};

const savedDraft: DeliveryChannelCatalogueDraft = {
  draftRevision: 'draft-1',
  mappingRevision: 'mapping-1',
  updatedAt: '2026-10-02T10:00:00Z',
  items: [item],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function mappedCatalogue(productId: string, revision: string): DeliveryChannelCatalogue {
  return {
    ...initialCatalogue,
    draftRevision: revision,
    mappingRevision: `mapping-${revision}`,
    items: [{ ...item, productId, productName: productId }],
  };
}

function draftFor(productId: string, revision: string): DeliveryChannelCatalogueDraft {
  return {
    draftRevision: revision,
    mappingRevision: `mapping-${revision}`,
    updatedAt: '2026-10-02T10:00:00Z',
    items: [{ ...item, productId, productName: productId }],
  };
}

afterEach(() => jest.restoreAllMocks());

describe('useDeliveryChannelCatalogue', () => {
  it('creates the initial draft with a null revision even when bootstrap selections are untouched', async () => {
    jest.spyOn(deliveryChannelManagementService, 'getCatalogue').mockResolvedValue(initialCatalogue);
    jest.spyOn(deliveryChannelManagementService, 'getCandidates').mockResolvedValue({
      currency: 'EUR',
      language: 'en',
      nextCursor: null,
      items: [],
    });
    const save = jest.spyOn(deliveryChannelManagementService, 'saveDraft').mockResolvedValue(savedDraft);
    const { result } = renderHook(() => useDeliveryChannelCatalogue());

    await waitFor(() => expect(result.current.catalogue).toEqual(initialCatalogue));
    expect(result.current.dirty).toBe(true);
    await act(async () => {
      await result.current.saveDraft();
    });

    expect(save).toHaveBeenCalledWith({
      expectedDraftRevision: null,
      items: [{ providerItemId: 'uber-item-1', productId: 'product-1', variationId: null }],
    });
    expect(result.current.dirty).toBe(false);
  });

  it('unlocks after a fresh canonical readback and ignores an older catalogue response', async () => {
    const oldRequest = deferred<DeliveryChannelCatalogue>();
    const initial = mappedCatalogue('product-1', 'draft-0');
    const canonicalAfterLostReply = mappedCatalogue('product-2', 'draft-1');
    const candidates = [2, 3].map((number) => ({
      productId: `product-${number}`,
      variationId: null,
      name: `Product ${number}`,
      variationName: null,
      priceMinor: 500,
      available: true,
      supported: true,
      blockReason: '',
    }));
    jest
      .spyOn(deliveryChannelManagementService, 'getCatalogue')
      .mockResolvedValueOnce(initial)
      .mockReturnValueOnce(oldRequest.promise)
      .mockResolvedValueOnce(canonicalAfterLostReply);
    jest.spyOn(deliveryChannelManagementService, 'getCandidates').mockResolvedValue({
      currency: 'EUR',
      language: 'en',
      nextCursor: null,
      items: candidates,
    });
    const save = jest
      .spyOn(deliveryChannelManagementService, 'saveDraft')
      .mockRejectedValueOnce(new ApiError(503, 'response lost'))
      .mockResolvedValueOnce(draftFor('product-3', 'draft-2'));
    const { result } = renderHook(() => useDeliveryChannelCatalogue());

    await waitFor(() => expect(result.current.catalogue?.draftRevision).toBe('draft-0'));
    let olderRefresh!: Promise<boolean>;
    act(() => {
      olderRefresh = result.current.refresh();
    });
    await waitFor(() => expect(deliveryChannelManagementService.getCatalogue).toHaveBeenCalledTimes(2));

    act(() => result.current.choose('uber-item-1', candidateIdentity('product-2', null)));
    let lostReplySave!: Promise<boolean>;
    act(() => {
      lostReplySave = result.current.saveDraft();
    });
    await waitFor(() => expect(deliveryChannelManagementService.getCatalogue).toHaveBeenCalledTimes(3));
    await act(async () => {
      await lostReplySave;
    });

    expect(result.current.catalogue?.draftRevision).toBe('draft-1');
    expect(result.current.writeUncertain).toBe(false);
    expect(result.current.stale).toBe(false);

    await act(async () => {
      oldRequest.resolve(initial);
      expect(await olderRefresh).toBe(false);
    });
    expect(result.current.catalogue?.draftRevision).toBe('draft-1');

    act(() => result.current.choose('uber-item-1', candidateIdentity('product-3', null)));
    expect(result.current.dirty).toBe(true);
    await act(async () => {
      expect(await result.current.saveDraft()).toBe(true);
    });
    expect(save).toHaveBeenLastCalledWith({
      expectedDraftRevision: 'draft-1',
      items: [{ providerItemId: 'uber-item-1', productId: 'product-3', variationId: null }],
    });
    expect(result.current.catalogue?.draftRevision).toBe('draft-2');
  });
});
