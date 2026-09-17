import { renderHook, act } from '@testing-library/react';
import type { Product } from '@/app/admin/menu-management/interfaces';
import { useOfferFamilyRows } from './useOfferFamilyRows';

const product = (id: string, type: string, parentOfferProductId?: string): Product => ({
  id,
  name: id,
  description: '',
  basePrice: 10,
  isActive: true,
  isAvailable: true,
  type,
  imageUrl: null,
  images: [],
  parentOfferProductId,
});

describe('useOfferFamilyRows', () => {
  it('groups a parent and child that arrived on different API pages before local pagination', () => {
    const { result } = renderHook(() =>
      useOfferFamilyRows([product('menu-page-2', 'menu', 'item-page-1'), product('item-page-1', 'mainItem')]),
    );

    expect(result.current.totalCount).toBe(1);
    expect(result.current.rows[0]).toMatchObject({
      kind: 'family',
      anchor: { id: 'item-page-1' },
      menuOffers: [{ id: 'menu-page-2' }],
    });
  });

  it('searches across anchor and offer names while keeping pagination local', () => {
    const { result } = renderHook(() =>
      useOfferFamilyRows([product('item-1', 'mainItem'), product('item-2', 'mainItem')]),
    );

    act(() => result.current.setSearchQuery('item-2'));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]).toMatchObject({ kind: 'independent', product: { id: 'item-2' } });
  });
});
