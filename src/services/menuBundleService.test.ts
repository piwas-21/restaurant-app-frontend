import { apiClient } from '@/utils/apiClient';
import { OrderType } from '@/types/order';
import { getPublicMenuBundles, patchMenuBundleSections } from './menuBundleService';

/**
 * `getPublicMenuBundles` gained the guest's order type (§9.2). As with `getProducts`, the server
 * does NOT filter on it — it resolves each row's `availability` — so what is worth pinning is that
 * the parameter reaches the query string under the name the backend binds, and that omitting it
 * leaves the request byte-identical for every caller that has none.
 */
const mockedGet = apiClient.get as jest.Mock;
const mockedPatch = apiClient.patch as jest.Mock;

function requestedUrl(): string {
  return mockedGet.mock.calls[0][0] as string;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGet.mockResolvedValue({ success: true, data: { items: [] } });
});

describe('getPublicMenuBundles — RequestedOrderType', () => {
  it('sends the chosen channel under the name the backend binds', async () => {
    await getPublicMenuBundles(1, 10, OrderType.Takeaway);

    expect(requestedUrl()).toContain('RequestedOrderType=Takeaway');
  });

  it('sends nothing when no channel is chosen — the dominant browse state', async () => {
    await getPublicMenuBundles(1, 10, null);

    expect(requestedUrl()).toBe('/api/Menus?page=1&pageSize=10');
  });

  it('leaves a caller that never passes one untouched', async () => {
    await getPublicMenuBundles(2, 20);

    expect(requestedUrl()).toBe('/api/Menus?page=2&pageSize=20');
  });
});

describe('patchMenuBundleSections — versioned section writes', () => {
  it('sends the ETag and only persisted IDs for a mixed existing/new draft', async () => {
    const sections = [
      {
        id: 'section-existing',
        name: 'Choose a main',
        description: '',
        displayOrder: 0,
        isRequired: true,
        minSelection: 1,
        maxSelection: 1,
        items: [
          {
            id: 'item-existing',
            productId: 'product-existing',
            additionalPrice: 0,
            displayOrder: 0,
            isDefault: true,
          },
          {
            id: 'temp-new-item',
            productId: 'product-new',
            additionalPrice: 1,
            displayOrder: 1,
            isDefault: false,
          },
        ],
      },
      {
        id: 'temp-new-section',
        name: 'Choose a drink',
        description: '',
        displayOrder: 1,
        isRequired: false,
        minSelection: 0,
        maxSelection: 1,
        items: [
          {
            id: 'temp-new-section-item',
            productId: 'product-drink',
            additionalPrice: 2,
            displayOrder: 0,
            isDefault: false,
          },
        ],
      },
    ];
    const persistedSections = [
      { ...sections[0], items: [sections[0].items[0], { ...sections[0].items[1], id: 'item-new' }] },
      { ...sections[1], id: 'section-new', items: [{ ...sections[1].items[0], id: 'item-new-section' }] },
    ];
    const patchResult = { authoringVersion: 8, sections: persistedSections };
    mockedPatch.mockResolvedValue({ success: true, data: patchResult });

    await expect(patchMenuBundleSections('menu-1', 7, sections)).resolves.toEqual(patchResult);

    expect(mockedPatch).toHaveBeenCalledWith(
      '/api/Menus/menu-1/sections',
      {
        sections: [
          {
            id: 'section-existing',
            name: 'Choose a main',
            description: '',
            displayOrder: 0,
            isRequired: true,
            minSelection: 1,
            maxSelection: 1,
            allowRepeatedItems: false,
            items: [
              {
                id: 'item-existing',
                productId: 'product-existing',
                additionalPrice: 0,
                displayOrder: 0,
                isDefault: true,
              },
              {
                productId: 'product-new',
                additionalPrice: 1,
                displayOrder: 1,
                isDefault: false,
              },
            ],
          },
          {
            name: 'Choose a drink',
            description: '',
            displayOrder: 1,
            isRequired: false,
            minSelection: 0,
            maxSelection: 1,
            allowRepeatedItems: false,
            items: [
              {
                productId: 'product-drink',
                additionalPrice: 2,
                displayOrder: 0,
                isDefault: false,
              },
            ],
          },
        ],
      },
      { requireAuth: true, headers: { 'If-Match': '"7"' } },
    );
    expect(JSON.stringify(mockedPatch.mock.calls[0][1])).not.toContain('temp-');
  });
});
