import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@/utils/apiClient';
import { deliveryChannelManagementService } from '@/services/deliveryChannelManagementService';
import type {
  DeliveryChannelCatalogue,
  DeliveryChannelCatalogueCandidates,
  DeliveryChannelCatalogueDraft,
} from '@/types/deliveryChannelCatalogue';
import { deliveryChannelMappingView } from '@/utils/deliveryChannelMappingView';
import { candidateIdentity, useDeliveryChannelCatalogue } from './useDeliveryChannelCatalogue';

let mockTranslate = (key: string) => key;
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

afterEach(() => {
  jest.restoreAllMocks();
  mockTranslate = (key: string) => key;
});

describe('useDeliveryChannelCatalogue', () => {
  it('preserves a usable dirty draft when the translator changes identity', async () => {
    const getCatalogue = jest
      .spyOn(deliveryChannelManagementService, 'getCatalogue')
      .mockResolvedValue(mappedCatalogue('product-1', 'draft-0'));
    const getCandidates = jest
      .spyOn(deliveryChannelManagementService, 'getCandidates')
      .mockResolvedValue({ currency: 'EUR', language: 'en', items: [], nextCursor: null });
    const save = jest
      .spyOn(deliveryChannelManagementService, 'saveDraft')
      .mockResolvedValue(draftFor('product-2', 'draft-1'));
    const { result, rerender } = renderHook(() => useDeliveryChannelCatalogue());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.choose('uber-item-1', candidateIdentity('product-2', null)));
    mockTranslate = (key: string) => `translated:${key}`;
    rerender();
    expect(getCatalogue).toHaveBeenCalledTimes(1);
    expect(getCandidates).toHaveBeenCalledTimes(1);
    expect(result.current.selected['uber-item-1']).toBe('product-2::');
    expect(result.current.dirty).toBe(true);
    expect(result.current.stale).toBe(false);
    await act(async () => {
      expect(await result.current.saveDraft()).toBe(true);
    });
    expect(save).toHaveBeenCalledWith({
      expectedDraftRevision: 'draft-0',
      items: [{ providerItemId: 'uber-item-1', productId: 'product-2', variationId: null }],
    });
    getCandidates.mockRejectedValueOnce(new Error('Unavailable'));
    await act(async () => {
      await result.current.searchCandidates('Missing');
    });
    expect(result.current.errorMessage).toBe('translated:deliveryChannels.errors.load');
  });

  it('clears visible results for a failed new query but preserves cached draft names and load-more results', async () => {
    const soup = {
      productId: 'soup',
      variationId: null,
      name: 'Soup',
      variationName: null,
      priceMinor: 500,
      available: true,
      supported: true,
      blockReason: '',
    };
    jest.spyOn(deliveryChannelManagementService, 'getCatalogue').mockResolvedValue(initialCatalogue);
    const getCandidates = jest
      .spyOn(deliveryChannelManagementService, 'getCandidates')
      .mockResolvedValueOnce({ currency: 'EUR', language: 'en', items: [soup], nextCursor: 'page-2' });
    const { result } = renderHook(() => useDeliveryChannelCatalogue());
    await waitFor(() => expect(result.current.candidates).toEqual([soup]));
    getCandidates.mockRejectedValueOnce(new Error('Unavailable'));
    await act(async () => {
      await result.current.searchCandidates('Soup', 'page-2');
    });
    expect(result.current.candidates).toEqual([soup]);
    expect(result.current.candidateCursor).toBe('page-2');
    getCandidates.mockRejectedValueOnce(new Error('Unavailable'));
    await act(async () => {
      await result.current.searchCandidates('Falafel', null);
    });
    expect(result.current.candidates).toEqual([]);
    expect(result.current.candidateCursor).toBeNull();
    expect(result.current.knownCandidates).toEqual([soup]);
    expect(result.current.error).toBe('load');
  });

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

  it('keeps stable ID selections from separate mapping pages and does not merge same-name products', async () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      ...item,
      providerItemId: `uber-item-${index + 1}`,
      productId: null,
      productName: null,
      mappingStatus: 'unmapped' as const,
    }));
    const catalogue = { ...initialCatalogue, items: rows };
    const candidates = [
      {
        productId: 'tenant-product-1',
        variationId: null,
        name: 'Same product name',
        variationName: null,
        priceMinor: 500,
        available: true,
        supported: true,
        blockReason: '',
      },
      {
        productId: 'tenant-product-2',
        variationId: null,
        name: 'Same product name',
        variationName: null,
        priceMinor: 600,
        available: true,
        supported: true,
        blockReason: '',
      },
    ];
    jest.spyOn(deliveryChannelManagementService, 'getCatalogue').mockResolvedValue(catalogue);
    jest.spyOn(deliveryChannelManagementService, 'getCandidates').mockResolvedValue({
      currency: 'EUR',
      language: 'en',
      nextCursor: null,
      items: candidates,
    });
    const save = jest.spyOn(deliveryChannelManagementService, 'saveDraft').mockResolvedValue({
      ...savedDraft,
      items: rows,
    });
    const { result } = renderHook(() => useDeliveryChannelCatalogue());

    await waitFor(() => expect(result.current.catalogue?.items).toHaveLength(21));
    const firstPage = deliveryChannelMappingView(rows, { status: 'all', search: '', page: 0 });
    const secondPage = deliveryChannelMappingView(rows, { status: 'all', search: '', page: 1 });
    expect(firstPage.rows[0].providerItemId).toBe('uber-item-1');
    expect(secondPage.rows[0].providerItemId).toBe('uber-item-21');

    act(() => result.current.choose(firstPage.rows[0].providerItemId, candidateIdentity('tenant-product-1', null)));
    act(() => result.current.choose(secondPage.rows[0].providerItemId, candidateIdentity('tenant-product-2', null)));
    expect(result.current.duplicateSelection).toBe(false);
    await act(async () => {
      await result.current.saveDraft();
    });

    expect(save).toHaveBeenCalledWith({
      expectedDraftRevision: null,
      items: [
        { providerItemId: 'uber-item-1', productId: 'tenant-product-1', variationId: null },
        { providerItemId: 'uber-item-21', productId: 'tenant-product-2', variationId: null },
      ],
    });
  });

  it('does not read catalogue details until the tenant summary enables management', async () => {
    const getCatalogue = jest
      .spyOn(deliveryChannelManagementService, 'getCatalogue')
      .mockResolvedValue(initialCatalogue);
    const getCandidates = jest.spyOn(deliveryChannelManagementService, 'getCandidates').mockResolvedValue({
      currency: 'EUR',
      language: 'en',
      nextCursor: null,
      items: [],
    });
    const { result, rerender } = renderHook(({ enabled }) => useDeliveryChannelCatalogue(enabled), {
      initialProps: { enabled: false },
    });

    expect(result.current.catalogue).toBeNull();
    expect(getCatalogue).not.toHaveBeenCalled();
    expect(getCandidates).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.catalogue).toEqual(initialCatalogue));
    expect(getCatalogue).toHaveBeenCalledTimes(1);
    expect(getCandidates).toHaveBeenCalledTimes(1);
  });

  it('discards reads started before the access gate closes and reloads after it opens', async () => {
    const oldCatalogue = deferred<DeliveryChannelCatalogue>();
    const oldCandidates = deferred<DeliveryChannelCatalogueCandidates>();
    const freshCatalogue = { ...initialCatalogue, mappingRevision: 'fresh-mapping' };
    const freshCandidate = {
      productId: 'fresh-product',
      variationId: null,
      name: 'Fresh result',
      variationName: null,
      priceMinor: 500,
      available: true,
      supported: true,
      blockReason: '',
    };
    const candidate = { ...freshCandidate, productId: 'old-product', name: 'Old result' };
    const getCatalogue = jest
      .spyOn(deliveryChannelManagementService, 'getCatalogue')
      .mockReturnValueOnce(oldCatalogue.promise)
      .mockResolvedValueOnce(freshCatalogue);
    const getCandidates = jest
      .spyOn(deliveryChannelManagementService, 'getCandidates')
      .mockReturnValueOnce(oldCandidates.promise)
      .mockResolvedValueOnce({ currency: 'EUR', language: 'en', nextCursor: null, items: [freshCandidate] });
    const { result, rerender } = renderHook(({ enabled }) => useDeliveryChannelCatalogue(enabled), {
      initialProps: { enabled: true },
    });
    await waitFor(() => expect(getCatalogue).toHaveBeenCalledTimes(1));

    rerender({ enabled: false });
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.catalogue?.mappingRevision).toBe('fresh-mapping'));
    expect(getCatalogue).toHaveBeenCalledTimes(2);
    expect(getCandidates).toHaveBeenCalledTimes(2);

    await act(async () => {
      oldCatalogue.resolve(initialCatalogue);
      oldCandidates.resolve({ currency: 'EUR', language: 'en', nextCursor: null, items: [candidate] });
      await Promise.resolve();
    });
    expect(result.current.catalogue?.mappingRevision).toBe('fresh-mapping');
    expect(result.current.candidates).toEqual([freshCandidate]);
  });

  it('keeps filtered results visible while caching fetched candidate identities with latest values', async () => {
    const first = {
      productId: 'product-2',
      variationId: null,
      name: 'Soup v1',
      variationName: null,
      priceMinor: 500,
      available: true,
      supported: true,
      blockReason: '',
    };
    const second = { ...first, productId: 'product-3', name: 'Salad' };
    const refreshedFirst = { ...first, name: 'Soup updated', priceMinor: 550 };
    jest.spyOn(deliveryChannelManagementService, 'getCatalogue').mockResolvedValue(initialCatalogue);
    const search = jest.spyOn(deliveryChannelManagementService, 'getCandidates').mockResolvedValueOnce({
      currency: 'EUR',
      language: 'en',
      nextCursor: null,
      items: [first, second],
    });
    const { result } = renderHook(() => useDeliveryChannelCatalogue());
    await waitFor(() => expect(result.current.candidates).toEqual([first, second]));

    search.mockResolvedValueOnce({
      currency: 'EUR',
      language: 'en',
      nextCursor: null,
      items: [refreshedFirst],
    });
    await act(async () => {
      await result.current.searchCandidates('Soup');
    });

    expect(result.current.candidates).toEqual([refreshedFirst]);
    expect(result.current.knownCandidates).toEqual([refreshedFirst, second]);
  });
});
