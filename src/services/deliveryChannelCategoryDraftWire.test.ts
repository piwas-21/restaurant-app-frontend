jest.unmock('@/utils/apiClient');

import { act, renderHook } from '@testing-library/react';
import { useRef, useState } from 'react';
import { apiClient } from '@/utils/apiClient';
import type {
  DeliveryChannelCategoryDraft,
  DeliveryChannelCategoryInventory,
  DeliveryChannelCategoryItemOverride,
} from '@/types/deliveryChannelMenuSelection';
import {
  useDeliveryChannelCategoryDraftSave,
  type CategorySaveAttempt,
  type CategorySelectionError,
} from '@/hooks/admin/useDeliveryChannelCategoryDraftSave';

const originalFetch = global.fetch;

function useCategoryDraftSaveForWireTest() {
  const [inventory, setInventory] = useState<DeliveryChannelCategoryInventory | null>({
    selectionMode: 'categoryItemsV1',
    maximumSelectedItemCount: 200,
    maximumCategoryCount: 1000,
    maximumItemOverrideCount: 2000,
    sourceRevision: 'source-1',
    language: 'en',
    categories: [
      {
        categoryId: 'category-1',
        name: 'Mains',
        displayOrder: 1,
        totalItemCount: 2,
        supportedItemCount: 2,
        unsupportedItemCount: 0,
      },
    ],
    sourceChanged: false,
    draft: null,
  });
  const [busy, setBusy] = useState<'load' | 'save' | null>(null);
  const [, setError] = useState<CategorySelectionError | null>(null);
  const saveAttempt = useRef<CategorySaveAttempt | null>(null);
  const uncertainWrite = useRef(false);
  const markSaved = (_draft: DeliveryChannelCategoryDraft) => undefined;

  return useDeliveryChannelCategoryDraftSave({
    enabled: true,
    inventory,
    categoryIds: new Set(['category-1']),
    overrides: {
      'product-1::': {
        selectionKey: 'product-1::',
        productId: 'product-1',
        variationId: null,
        categoryId: 'category-1',
        selected: false,
        supported: true,
      } satisfies DeliveryChannelCategoryItemOverride,
    },
    needsSave: true,
    locked: false,
    busy,
    writeUncertain: false,
    saveAttempt,
    uncertainWrite,
    setInventory,
    setBusy,
    setError,
    setConflict: jest.fn(),
    setWriteUncertain: jest.fn(),
    recordAcknowledgement: jest.fn(),
    markSaved,
    refreshCanonical: async () => undefined,
  });
}

describe('category draft wire contract', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.removeItem('auth_token');
  });

  it('sends the hook-built category payload through the authenticated API client', async () => {
    localStorage.setItem('auth_token', 'test-token');
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ draftRevision: 'draft-2' }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useCategoryDraftSaveForWireTest());
    await act(async () => {
      await result.current();
    });

    expect(jest.isMockFunction(apiClient.put)).toBe(false);
    const [url, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit];
    expect(String(url)).toContain('/api/delivery-channels/management/uber/catalogue/draft');
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
    expect(JSON.parse(init.body as string)).toEqual({
      expectedDraftRevision: null,
      items: [],
      expectedSourceRevision: 'source-1',
      categoryIds: ['category-1'],
      itemOverrides: [
        {
          productId: 'product-1',
          variationId: null,
          categoryId: 'category-1',
          selected: false,
        },
      ],
    });
  });
});
