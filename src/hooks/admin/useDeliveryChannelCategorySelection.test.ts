import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@/utils/apiClient';
import { deliveryChannelManagementService } from '@/services/deliveryChannelManagementService';
import type {
  DeliveryChannelCategoryDraft,
  DeliveryChannelCategoryCandidatePage,
  DeliveryChannelCategoryInventory,
  DeliveryChannelCategoryItem,
  DeliveryChannelCategoryReferenceChanges,
} from '@/types/deliveryChannelMenuSelection';
import type { DeliveryChannelCatalogue } from '@/types/deliveryChannelCatalogue';
import { useDeliveryChannelCategorySelection } from './useDeliveryChannelCategorySelection';
import { useDeliveryChannelPublication } from './useDeliveryChannelPublication';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const category = {
  categoryId: 'mains',
  name: 'Mains',
  displayOrder: 1,
  totalItemCount: 80,
  supportedItemCount: 76,
  unsupportedItemCount: 4,
};

const inventory: DeliveryChannelCategoryInventory = {
  selectionMode: 'categoryItemsV1',
  maximumSelectedItemCount: 200,
  maximumCategoryCount: 1000,
  maximumItemOverrideCount: 2000,
  sourceRevision: 'source-1',
  language: 'en',
  categories: [category],
  sourceChanged: false,
  draft: null,
};

const blockedItem: DeliveryChannelCategoryItem = {
  selectionKey: 'soup-large',
  providerItemId: 'provider-soup-large',
  productId: 'soup',
  variationId: 'large',
  categoryId: 'mains',
  categoryName: 'Mains',
  categoryDisplayOrder: 1,
  itemDisplayOrder: 2,
  name: 'Soup',
  variationName: 'Large',
  priceMinor: 850,
  available: false,
  supported: false,
  blockReason: 'UnsupportedChoices',
};

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function savedDraft(): DeliveryChannelCategoryDraft {
  return {
    draftRevision: 'draft-1',
    sourceRevision: 'source-1',
    language: 'en',
    selectedCategoryIds: ['mains'],
    itemOverrides: [
      {
        selectionKey: blockedItem.selectionKey,
        productId: blockedItem.productId,
        variationId: blockedItem.variationId,
        categoryId: blockedItem.categoryId,
        selected: false,
        supported: blockedItem.supported,
      },
    ],
    categories: [{ ...category, selectedItemCount: 79, selectedUnsupportedItemCount: 3, selectionState: 'partial' }],
    items: [],
  };
}

function referenceChanges(
  sourceRevision: string,
  categories: DeliveryChannelCategoryInventory['categories'],
  removedItemOverrides: DeliveryChannelCategoryReferenceChanges['removedItemOverrides'] = [],
  removedCategoryIds: readonly string[] = [],
  removedItems: DeliveryChannelCategoryReferenceChanges['removedItems'] = [],
  itemStatuses: DeliveryChannelCategoryReferenceChanges['itemStatuses'] = [],
): DeliveryChannelCategoryReferenceChanges {
  return {
    sourceRevision,
    sourceChanged: false,
    language: 'en',
    maximumCategoryCount: 1000,
    maximumItemOverrideCount: 2000,
    categories,
    removedCategoryIds,
    removedItems,
    removedItemOverrides,
    itemStatuses,
  };
}

afterEach(() => jest.restoreAllMocks());

it('makes no management calls while disabled, then loads the category snapshot and first page when enabled', async () => {
  const getInventory = jest
    .spyOn(deliveryChannelManagementService, 'getCategoryInventory')
    .mockResolvedValue(inventory);
  const getCandidates = jest
    .spyOn(deliveryChannelManagementService, 'getCategoryCandidates')
    .mockResolvedValue({ sourceRevision: 'source-1', language: 'en', nextCursor: null, items: [] });
  const { result, rerender } = renderHook(
    ({ enabled }: { enabled: boolean }) => useDeliveryChannelCategorySelection(enabled),
    {
      initialProps: { enabled: false },
    },
  );

  expect(getInventory).not.toHaveBeenCalled();
  expect(getCandidates).not.toHaveBeenCalled();
  rerender({ enabled: true });
  await waitFor(() => expect(result.current.inventory).toEqual(inventory));
  await waitFor(() => expect(getCandidates).toHaveBeenCalledWith('', null, null, 'source-1'));
});

it('saves the full category selection and negative item override with the source CAS revision', async () => {
  jest.spyOn(deliveryChannelManagementService, 'getCategoryInventory').mockResolvedValue(inventory);
  jest
    .spyOn(deliveryChannelManagementService, 'getCategoryCandidates')
    .mockImplementation(async (_search, _categoryId, _cursor, sourceRevision) => ({
      sourceRevision,
      language: 'en',
      nextCursor: null,
      items: sourceRevision === 'source-1' ? [blockedItem] : [],
    }));
  const save = jest.spyOn(deliveryChannelManagementService, 'saveCategoryDraft').mockResolvedValue(savedDraft());
  const { result } = renderHook(() => useDeliveryChannelCategorySelection(true));
  await waitFor(() => expect(result.current.inventory).toEqual(inventory));
  await waitFor(() => expect(result.current.candidates).toEqual([blockedItem]));

  act(() => result.current.toggleCategory('mains', true));
  expect(result.current.selectedCount).toBe(80);
  act(() => result.current.toggleItem(blockedItem, false));
  expect(result.current.selectedCount).toBe(79);
  expect(result.current.unsupportedCount).toBe(3);

  await act(async () => {
    expect(await result.current.saveDraft()).toBe(true);
  });
  expect(save).toHaveBeenCalledWith({
    expectedDraftRevision: null,
    expectedSourceRevision: 'source-1',
    categoryIds: ['mains'],
    itemOverrides: [
      {
        productId: blockedItem.productId,
        variationId: blockedItem.variationId,
        categoryId: blockedItem.categoryId,
        selected: false,
      },
    ],
  });
  expect(result.current.needsSave).toBe(false);
  expect(result.current.writeUncertain).toBe(false);
});

it('preserves an over-limit local selection without submitting an invalid draft', async () => {
  const overLimitInventory = {
    ...inventory,
    maximumSelectedItemCount: 200,
    categories: [{ ...category, totalItemCount: 250, unsupportedItemCount: 0, supportedItemCount: 250 }],
  };
  jest.spyOn(deliveryChannelManagementService, 'getCategoryInventory').mockResolvedValue(overLimitInventory);
  jest.spyOn(deliveryChannelManagementService, 'getCategoryCandidates').mockResolvedValue({
    sourceRevision: 'source-1',
    language: 'en',
    nextCursor: null,
    items: [],
  });
  const save = jest.spyOn(deliveryChannelManagementService, 'saveCategoryDraft');
  const { result } = renderHook(() => useDeliveryChannelCategorySelection(true));
  await waitFor(() => expect(result.current.inventory).toEqual(overLimitInventory));
  act(() => result.current.toggleCategory('mains', true));

  await act(async () => {
    expect(await result.current.saveDraft()).toBe(false);
  });
  expect(save).not.toHaveBeenCalled();
  expect(result.current.categoryIds.has('mains')).toBe(true);
  expect(result.current.selectedCount).toBe(250);
  expect(result.current.needsSave).toBe(true);
  expect(result.current.error).toBe('selectionLimit');
  expect(result.current.writeUncertain).toBe(false);
});

it('keeps the draft when the server rejects a category expansion that exceeded its review limit', async () => {
  const backendLimitedInventory = {
    ...inventory,
    maximumSelectedItemCount: 300,
    categories: [{ ...category, totalItemCount: 250, unsupportedItemCount: 0, supportedItemCount: 250 }],
  };
  jest.spyOn(deliveryChannelManagementService, 'getCategoryInventory').mockResolvedValue(backendLimitedInventory);
  jest.spyOn(deliveryChannelManagementService, 'getCategoryCandidates').mockResolvedValue({
    sourceRevision: 'source-1',
    language: 'en',
    nextCursor: null,
    items: [],
  });
  const save = jest
    .spyOn(deliveryChannelManagementService, 'saveCategoryDraft')
    .mockRejectedValue(new ApiError(409, '', undefined, 'SelectionLimitExceeded'));
  const { result } = renderHook(() => useDeliveryChannelCategorySelection(true));
  await waitFor(() => expect(result.current.inventory).toEqual(backendLimitedInventory));
  act(() => result.current.toggleCategory('mains', true));

  await act(async () => expect(await result.current.saveDraft()).toBe(false));

  expect(save).toHaveBeenCalledTimes(1);
  expect(result.current.categoryIds.has('mains')).toBe(true);
  expect(result.current.error).toBe('selectionLimit');
  expect(result.current.needsSave).toBe(true);
  expect(result.current.writeUncertain).toBe(false);
});

it('keeps category choices local and explains the category ID cap before save', async () => {
  const limitedInventory = {
    ...inventory,
    maximumCategoryCount: 1,
    categories: [category, { ...category, categoryId: 'drinks', name: 'Drinks', displayOrder: 2 }],
  };
  jest.spyOn(deliveryChannelManagementService, 'getCategoryInventory').mockResolvedValue(limitedInventory);
  jest.spyOn(deliveryChannelManagementService, 'getCategoryCandidates').mockResolvedValue({
    sourceRevision: 'source-1',
    language: 'en',
    nextCursor: null,
    items: [],
  });
  const save = jest.spyOn(deliveryChannelManagementService, 'saveCategoryDraft');
  const { result } = renderHook(() => useDeliveryChannelCategorySelection(true));
  await waitFor(() => expect(result.current.inventory).toEqual(limitedInventory));
  act(() => result.current.toggleCategory('mains', true));
  act(() => result.current.toggleCategory('drinks', true));

  await act(async () => expect(await result.current.saveDraft()).toBe(false));

  expect(result.current.error).toBe('categoryLimit');
  expect(result.current.categoryIds.size).toBe(2);
  expect(save).not.toHaveBeenCalled();
});

it('keeps individual item choices local and explains the override cap before save', async () => {
  const limitedInventory = { ...inventory, maximumItemOverrideCount: 0 };
  jest.spyOn(deliveryChannelManagementService, 'getCategoryInventory').mockResolvedValue(limitedInventory);
  jest.spyOn(deliveryChannelManagementService, 'getCategoryCandidates').mockResolvedValue({
    sourceRevision: 'source-1',
    language: 'en',
    nextCursor: null,
    items: [blockedItem],
  });
  const save = jest.spyOn(deliveryChannelManagementService, 'saveCategoryDraft');
  const { result } = renderHook(() => useDeliveryChannelCategorySelection(true));
  await waitFor(() => expect(result.current.candidates).toEqual([blockedItem]));
  act(() => result.current.toggleItem(blockedItem, true));

  await act(async () => expect(await result.current.saveDraft()).toBe(false));

  expect(result.current.error).toBe('overrideLimit');
  expect(result.current.overrides[blockedItem.selectionKey]?.selected).toBe(true);
  expect(save).not.toHaveBeenCalled();
});

it('keeps a stale draft frozen until explicit source refresh, then rebases with its negative override', async () => {
  const currentCategory = { ...category, totalItemCount: 80, supportedItemCount: 76, unsupportedItemCount: 4 };
  const frozenCategory = {
    ...category,
    totalItemCount: 60,
    supportedItemCount: 57,
    unsupportedItemCount: 3,
    selectedItemCount: 59,
    selectedUnsupportedItemCount: 2,
    selectionState: 'partial' as const,
  };
  const retainedItem: DeliveryChannelCategoryItem = {
    ...blockedItem,
    selectionKey: 'soup-small',
    productId: 'soup-small',
    variationId: null,
    name: 'Soup small',
    variationName: null,
    supported: true,
    blockReason: null,
  };
  const staleInventory: DeliveryChannelCategoryInventory = {
    ...inventory,
    sourceRevision: 'source-2',
    categories: [currentCategory],
    sourceChanged: true,
    itemStatuses: [
      {
        selectionKey: blockedItem.selectionKey,
        productId: blockedItem.productId,
        variationId: blockedItem.variationId,
        categoryId: blockedItem.categoryId,
        currentCategoryId: blockedItem.categoryId,
        supported: false,
      },
    ],
    draft: {
      ...savedDraft(),
      sourceRevision: 'source-1',
      itemOverrides: savedDraft().itemOverrides.map((override) => ({ ...override, supported: true })),
      categories: [frozenCategory],
      items: [retainedItem],
    },
  };
  const reboundDraft: DeliveryChannelCategoryDraft = {
    ...savedDraft(),
    draftRevision: 'draft-2',
    sourceRevision: 'source-2',
    categories: [
      {
        ...currentCategory,
        selectedItemCount: 79,
        selectedUnsupportedItemCount: 3,
        selectionState: 'partial',
      },
    ],
  };
  jest.spyOn(deliveryChannelManagementService, 'getCategoryInventory').mockResolvedValue(staleInventory);
  const check = jest.spyOn(deliveryChannelManagementService, 'checkCategoryReferences').mockResolvedValue(
    referenceChanges(
      'source-2',
      [currentCategory],
      [],
      [],
      [],
      [
        {
          selectionKey: blockedItem.selectionKey,
          productId: blockedItem.productId,
          variationId: blockedItem.variationId,
          categoryId: blockedItem.categoryId,
          currentCategoryId: blockedItem.categoryId,
          supported: false,
        },
      ],
    ),
  );
  jest.spyOn(deliveryChannelManagementService, 'getCategoryCandidates').mockResolvedValue({
    sourceRevision: 'source-2',
    language: 'en',
    nextCursor: null,
    items: [],
  });
  const save = jest.spyOn(deliveryChannelManagementService, 'saveCategoryDraft').mockResolvedValue(reboundDraft);
  const { result } = renderHook(() => useDeliveryChannelCategorySelection(true));
  await waitFor(() => expect(result.current.inventory).toEqual(staleInventory));
  await waitFor(() => expect(result.current.selectedCount).toBe(59));
  expect(result.current.unsupportedCount).toBe(2);
  expect(result.current.stale).toBe(true);

  act(() => result.current.toggleCategory('mains', false));
  expect(result.current.categoryIds.has('mains')).toBe(true);
  await act(async () => expect(await result.current.saveDraft()).toBe(false));
  expect(save).not.toHaveBeenCalled();

  await act(async () => expect(await result.current.acknowledgeSource()).toBe(true));
  expect(check).toHaveBeenCalledWith({
    expectedSourceRevision: 'source-2',
    categoryIds: ['mains'],
    itemReferences: [{ productId: retainedItem.productId, variationId: null, categoryId: 'mains' }],
    itemOverrides: [
      {
        productId: blockedItem.productId,
        variationId: blockedItem.variationId,
        categoryId: blockedItem.categoryId,
        selected: false,
      },
    ],
  });
  await waitFor(() => expect(result.current.stale).toBe(false));
  expect(result.current.selectedCount).toBe(79);
  expect(result.current.unsupportedCount).toBe(3);
  expect(result.current.inventory?.itemStatuses).toEqual([
    {
      selectionKey: blockedItem.selectionKey,
      productId: blockedItem.productId,
      variationId: blockedItem.variationId,
      categoryId: blockedItem.categoryId,
      currentCategoryId: blockedItem.categoryId,
      supported: false,
    },
  ]);
  expect(result.current.needsSave).toBe(true);

  await act(async () => expect(await result.current.saveDraft()).toBe(true));
  expect(save).toHaveBeenCalledWith({
    expectedDraftRevision: 'draft-1',
    expectedSourceRevision: 'source-2',
    categoryIds: ['mains'],
    itemOverrides: [
      {
        productId: blockedItem.productId,
        variationId: blockedItem.variationId,
        categoryId: blockedItem.categoryId,
        selected: false,
      },
    ],
  });
  expect(result.current.selectedCount).toBe(79);
  expect(result.current.needsSave).toBe(false);
});

it('keeps source review locked while reference and candidate readbacks are pending', async () => {
  const referenceReply = deferred<DeliveryChannelCategoryReferenceChanges>();
  const candidateReply = deferred<DeliveryChannelCategoryCandidatePage>();
  const referenceCheck = jest
    .spyOn(deliveryChannelManagementService, 'checkCategoryReferences')
    .mockReturnValue(referenceReply.promise);
  const getCandidates = jest
    .spyOn(deliveryChannelManagementService, 'getCategoryCandidates')
    .mockResolvedValueOnce({ sourceRevision: 'source-1', language: 'en', nextCursor: null, items: [] })
    .mockReturnValueOnce(candidateReply.promise);
  jest
    .spyOn(deliveryChannelManagementService, 'getCategoryInventory')
    .mockResolvedValue({ ...inventory, draft: savedDraft(), draftRevision: 'draft-1' });
  const save = jest.spyOn(deliveryChannelManagementService, 'saveCategoryDraft');
  const preview = jest.spyOn(deliveryChannelManagementService, 'preview');
  const { result } = renderHook(() => {
    const selection = useDeliveryChannelCategorySelection(true);
    const publication = useDeliveryChannelPublication({
      catalogue,
      selectionVersion: selection.selectionVersion,
      dirty: selection.dirty,
      stale: selection.stale,
      draftWriteUncertain: selection.writeUncertain,
      refreshCatalogue: selection.refresh,
    });
    return { selection, publication };
  });
  await waitFor(() => expect(getCandidates).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(result.current.selection.candidateBusy).toBe(false));
  expect(result.current.selection.dirty).toBe(false);

  let acknowledgement!: Promise<boolean>;
  act(() => {
    acknowledgement = result.current.selection.acknowledgeSource();
  });
  await waitFor(() => expect(referenceCheck).toHaveBeenCalledTimes(1));
  expect(result.current.selection.stale).toBe(true);
  await act(async () => expect(await result.current.selection.saveDraft()).toBe(false));
  await act(async () => expect(await result.current.publication.createPreview()).toBeNull());
  expect(save).not.toHaveBeenCalled();
  expect(preview).not.toHaveBeenCalled();

  referenceReply.resolve(referenceChanges('source-1', inventory.categories));
  await waitFor(() => expect(getCandidates).toHaveBeenCalledTimes(2));
  expect(result.current.selection.stale).toBe(true);
  await act(async () => expect(await result.current.selection.saveDraft()).toBe(false));
  await act(async () => expect(await result.current.publication.createPreview()).toBeNull());
  expect(save).not.toHaveBeenCalled();
  expect(preview).not.toHaveBeenCalled();

  candidateReply.resolve({ sourceRevision: 'source-1', language: 'en', nextCursor: null, items: [] });
  await act(async () => expect(await acknowledgement).toBe(true));
  expect(result.current.selection.stale).toBe(false);
});

it('does not acknowledge a source when its fresh candidate page is rejected by the backend', async () => {
  jest.spyOn(deliveryChannelManagementService, 'getCategoryInventory').mockResolvedValue(inventory);
  jest
    .spyOn(deliveryChannelManagementService, 'checkCategoryReferences')
    .mockResolvedValue(referenceChanges('source-1', inventory.categories));
  jest
    .spyOn(deliveryChannelManagementService, 'getCategoryCandidates')
    .mockResolvedValueOnce({ sourceRevision: 'source-1', language: 'en', nextCursor: null, items: [] })
    .mockRejectedValueOnce(new ApiError(409, '', undefined, 'SourceRevisionChanged'));
  const save = jest.spyOn(deliveryChannelManagementService, 'saveCategoryDraft');
  const { result } = renderHook(() => useDeliveryChannelCategorySelection(true));
  await waitFor(() => expect(result.current.inventory).toEqual(inventory));

  await act(async () => expect(await result.current.acknowledgeSource()).toBe(false));
  expect(result.current.stale).toBe(true);
  await act(async () => expect(await result.current.saveDraft()).toBe(false));
  expect(save).not.toHaveBeenCalled();
});

it('keeps a source locked when the refreshed candidate page has a network error', async () => {
  const staleInventory: DeliveryChannelCategoryInventory = {
    ...inventory,
    sourceRevision: 'source-2',
    sourceChanged: true,
    draft: { ...savedDraft(), sourceRevision: 'source-1' },
  };
  jest.spyOn(deliveryChannelManagementService, 'getCategoryInventory').mockResolvedValue(staleInventory);
  jest
    .spyOn(deliveryChannelManagementService, 'checkCategoryReferences')
    .mockResolvedValue(referenceChanges('source-2', inventory.categories));
  jest
    .spyOn(deliveryChannelManagementService, 'getCategoryCandidates')
    .mockResolvedValueOnce({ sourceRevision: 'source-2', language: 'en', nextCursor: null, items: [] })
    .mockRejectedValueOnce(new ApiError(500, '', undefined, 'GatewayUnavailable'));
  const save = jest.spyOn(deliveryChannelManagementService, 'saveCategoryDraft');
  const { result } = renderHook(() => useDeliveryChannelCategorySelection(true));
  await waitFor(() => expect(result.current.inventory).toEqual(staleInventory));

  await act(async () => expect(await result.current.acknowledgeSource()).toBe(false));

  expect(result.current.stale).toBe(true);
  expect(result.current.needsSave).toBe(true);
  await act(async () => expect(await result.current.saveDraft()).toBe(false));
  expect(save).not.toHaveBeenCalled();
});

it('keeps an unchanged source locked after candidate refresh fails with an unsaved item reference', async () => {
  jest.spyOn(deliveryChannelManagementService, 'getCategoryInventory').mockResolvedValue(inventory);
  jest
    .spyOn(deliveryChannelManagementService, 'checkCategoryReferences')
    .mockResolvedValue(referenceChanges('source-1', inventory.categories));
  jest
    .spyOn(deliveryChannelManagementService, 'getCategoryCandidates')
    .mockResolvedValueOnce({ sourceRevision: 'source-1', language: 'en', nextCursor: null, items: [blockedItem] })
    .mockRejectedValueOnce(new ApiError(500, '', undefined, 'GatewayUnavailable'));
  const save = jest.spyOn(deliveryChannelManagementService, 'saveCategoryDraft');
  const preview = jest.spyOn(deliveryChannelManagementService, 'preview');
  const { result } = renderHook(() => {
    const selection = useDeliveryChannelCategorySelection(true);
    const publication = useDeliveryChannelPublication({
      catalogue,
      selectionVersion: selection.selectionVersion,
      dirty: selection.dirty,
      stale: selection.stale,
      draftWriteUncertain: selection.writeUncertain,
      refreshCatalogue: selection.refresh,
    });
    return { selection, publication };
  });
  await waitFor(() => expect(result.current.selection.candidates).toEqual([blockedItem]));
  act(() => result.current.selection.toggleItem(blockedItem, true));
  expect(result.current.selection.needsSave).toBe(true);

  await act(async () => expect(await result.current.selection.acknowledgeSource()).toBe(false));

  expect(result.current.selection.stale).toBe(true);
  await act(async () => expect(await result.current.selection.saveDraft()).toBe(false));
  await act(async () => expect(await result.current.publication.createPreview()).toBeNull());
  expect(save).not.toHaveBeenCalled();
  expect(preview).not.toHaveBeenCalled();
});

it('keeps stale selections locked when the authoritative reference check has a network error', async () => {
  const staleInventory: DeliveryChannelCategoryInventory = {
    ...inventory,
    sourceRevision: 'source-2',
    sourceChanged: true,
    draft: { ...savedDraft(), sourceRevision: 'source-1' },
  };
  jest.spyOn(deliveryChannelManagementService, 'getCategoryInventory').mockResolvedValue(staleInventory);
  jest
    .spyOn(deliveryChannelManagementService, 'checkCategoryReferences')
    .mockRejectedValue(new ApiError(500, '', undefined, 'GatewayUnavailable'));
  jest.spyOn(deliveryChannelManagementService, 'getCategoryCandidates').mockResolvedValue({
    sourceRevision: 'source-2',
    language: 'en',
    nextCursor: null,
    items: [],
  });
  const save = jest.spyOn(deliveryChannelManagementService, 'saveCategoryDraft');
  const { result } = renderHook(() => useDeliveryChannelCategorySelection(true));
  await waitFor(() => expect(result.current.stale).toBe(true));

  await act(async () => expect(await result.current.acknowledgeSource()).toBe(false));

  expect(result.current.stale).toBe(true);
  expect(result.current.needsSave).toBe(true);
  await act(async () => expect(await result.current.saveDraft()).toBe(false));
  expect(save).not.toHaveBeenCalled();
});

it('locks an acknowledged source when refreshing the inventory snapshot fails', async () => {
  const consistentInventory: DeliveryChannelCategoryInventory = {
    ...inventory,
    draft: savedDraft(),
    draftRevision: 'draft-1',
  };
  const getInventory = jest
    .spyOn(deliveryChannelManagementService, 'getCategoryInventory')
    .mockResolvedValueOnce(consistentInventory)
    .mockRejectedValueOnce(new Error('network unavailable'));
  jest.spyOn(deliveryChannelManagementService, 'getCategoryCandidates').mockResolvedValue({
    sourceRevision: 'source-1',
    language: 'en',
    nextCursor: null,
    items: [],
  });
  const check = jest.spyOn(deliveryChannelManagementService, 'checkCategoryReferences');
  const save = jest.spyOn(deliveryChannelManagementService, 'saveCategoryDraft');
  const { result } = renderHook(() => useDeliveryChannelCategorySelection(true));
  await waitFor(() => expect(result.current.inventory).toEqual(consistentInventory));
  expect(result.current.stale).toBe(false);

  await act(async () => expect(await result.current.acknowledgeSource()).toBe(false));

  expect(getInventory).toHaveBeenCalledTimes(2);
  expect(check).not.toHaveBeenCalled();
  expect(result.current.stale).toBe(true);
  await act(async () => expect(await result.current.saveDraft()).toBe(false));
  expect(save).not.toHaveBeenCalled();
});

it('uses the latest source returned by the explicit reference check', async () => {
  const staleInventory: DeliveryChannelCategoryInventory = {
    ...inventory,
    sourceRevision: 'source-2',
    sourceChanged: true,
    draft: { ...savedDraft(), sourceRevision: 'source-1' },
  };
  const latestCategory = { ...category, name: 'Latest mains', totalItemCount: 82 };
  jest.spyOn(deliveryChannelManagementService, 'getCategoryInventory').mockResolvedValue(staleInventory);
  jest.spyOn(deliveryChannelManagementService, 'checkCategoryReferences').mockResolvedValue({
    ...referenceChanges('source-3', [latestCategory]),
    sourceChanged: true,
  });
  const getCandidates = jest
    .spyOn(deliveryChannelManagementService, 'getCategoryCandidates')
    .mockImplementation(async (_search, _categoryId, _cursor, sourceRevision) => ({
      sourceRevision,
      language: 'en',
      nextCursor: null,
      items: [],
    }));
  const { result } = renderHook(() => useDeliveryChannelCategorySelection(true));
  await waitFor(() => expect(result.current.inventory?.sourceRevision).toBe('source-2'));

  await act(async () => expect(await result.current.acknowledgeSource()).toBe(true));

  expect(result.current.inventory?.sourceRevision).toBe('source-3');
  expect(result.current.categories[0]?.name).toBe('Latest mains');
  expect(result.current.stale).toBe(false);
  expect(result.current.needsSave).toBe(true);
  expect(getCandidates).toHaveBeenCalledWith('', null, null, 'source-3');
});

it('removes only backend-confirmed retired categories and overrides after source acknowledgment', async () => {
  const replacementCategory = { ...category, categoryId: 'sides', name: 'Sides', totalItemCount: 4 };
  const saved = savedDraft();
  const staleInventory: DeliveryChannelCategoryInventory = {
    ...inventory,
    sourceRevision: 'source-2',
    categories: [replacementCategory],
    sourceChanged: true,
    removedCategoryIds: ['mains'],
    removedItemOverrides: saved.itemOverrides.map((override) => ({
      selectionKey: override.selectionKey,
      productId: override.productId,
      variationId: override.variationId,
      categoryId: override.categoryId,
      currentCategoryId: null,
      reason: 'categoryRemoved' as const,
    })),
    draft: { ...saved, sourceRevision: 'source-1' },
  };
  const nextDraft: DeliveryChannelCategoryDraft = {
    ...saved,
    draftRevision: 'draft-2',
    sourceRevision: 'source-2',
    selectedCategoryIds: [],
    itemOverrides: [],
    categories: [],
    items: [],
  };
  jest.spyOn(deliveryChannelManagementService, 'getCategoryInventory').mockResolvedValue(staleInventory);
  const removedOverride = {
    selectionKey: blockedItem.selectionKey,
    productId: blockedItem.productId,
    variationId: blockedItem.variationId,
    categoryId: blockedItem.categoryId,
    currentCategoryId: null,
    reason: 'itemRemoved' as const,
  };
  const check = jest
    .spyOn(deliveryChannelManagementService, 'checkCategoryReferences')
    .mockResolvedValue(referenceChanges('source-2', [replacementCategory], [removedOverride], ['mains']));
  jest.spyOn(deliveryChannelManagementService, 'getCategoryCandidates').mockResolvedValue({
    sourceRevision: 'source-2',
    language: 'en',
    nextCursor: null,
    items: [],
  });
  const save = jest.spyOn(deliveryChannelManagementService, 'saveCategoryDraft').mockResolvedValue(nextDraft);
  const { result } = renderHook(() => useDeliveryChannelCategorySelection(true));
  await waitFor(() => expect(result.current.categoryIds.has('mains')).toBe(true));
  await act(async () => expect(await result.current.acknowledgeSource()).toBe(true));

  expect(result.current.categoryIds.has('mains')).toBe(false);
  expect(result.current.overrides).toEqual({});
  expect(result.current.selectedCount).toBe(0);
  expect(result.current.removedSelectionNotice).toBe(true);
  expect(result.current.needsSave).toBe(true);
  await act(async () => expect(await result.current.saveDraft()).toBe(true));
  expect(save).toHaveBeenCalledWith({
    expectedDraftRevision: 'draft-1',
    expectedSourceRevision: 'source-2',
    categoryIds: [],
    itemOverrides: [],
  });
  expect(check).toHaveBeenCalledWith({
    expectedSourceRevision: 'source-2',
    categoryIds: ['mains'],
    itemReferences: [],
    itemOverrides: [
      {
        productId: blockedItem.productId,
        variationId: blockedItem.variationId,
        categoryId: blockedItem.categoryId,
        selected: false,
      },
    ],
  });
});

it('checks unsaved item overrides against the full source before removing missing references', async () => {
  const staleInventory: DeliveryChannelCategoryInventory = {
    ...inventory,
    sourceRevision: 'source-2',
    sourceChanged: true,
  };
  const removedOverride = {
    selectionKey: blockedItem.selectionKey,
    productId: blockedItem.productId,
    variationId: blockedItem.variationId,
    categoryId: blockedItem.categoryId,
    currentCategoryId: null,
    reason: 'itemRemoved' as const,
  };
  const getInventory = jest
    .spyOn(deliveryChannelManagementService, 'getCategoryInventory')
    .mockResolvedValueOnce(inventory)
    .mockResolvedValueOnce(staleInventory);
  const check = jest
    .spyOn(deliveryChannelManagementService, 'checkCategoryReferences')
    .mockResolvedValue(referenceChanges('source-2', inventory.categories, [removedOverride]));
  jest
    .spyOn(deliveryChannelManagementService, 'getCategoryCandidates')
    .mockImplementation(async (_search, _categoryId, _cursor, sourceRevision) => ({
      sourceRevision,
      language: 'en',
      nextCursor: null,
      items: sourceRevision === 'source-1' ? [blockedItem] : [],
    }));
  const { result } = renderHook(() => useDeliveryChannelCategorySelection(true));
  await waitFor(() => expect(result.current.candidates).toEqual([blockedItem]));
  act(() => result.current.toggleItem(blockedItem, true));
  expect(result.current.overrides[blockedItem.selectionKey]?.selected).toBe(true);

  await act(async () => expect(await result.current.acknowledgeSource()).toBe(true));

  expect(getInventory).toHaveBeenCalledTimes(2);
  expect(check).toHaveBeenCalledWith({
    expectedSourceRevision: 'source-2',
    categoryIds: [],
    itemReferences: [],
    itemOverrides: [
      {
        productId: blockedItem.productId,
        variationId: blockedItem.variationId,
        categoryId: blockedItem.categoryId,
        selected: true,
      },
    ],
  });
  expect(result.current.overrides).toEqual({});
  expect(result.current.selectedCount).toBe(0);
  expect(result.current.removedSelectionNotice).toBe(true);
  expect(result.current.needsSave).toBe(true);
});
