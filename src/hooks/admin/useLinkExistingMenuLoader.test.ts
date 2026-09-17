import { renderHook, waitFor } from '@testing-library/react';
import { getAllProducts } from '@/services/menuService';
import { useLinkExistingMenuLoader } from './useLinkExistingMenuLoader';
import type { Product } from '@/app/admin/menu-management/interfaces';

jest.mock('@/services/menuService');

const mockGetAllProducts = getAllProducts as jest.MockedFunction<typeof getAllProducts>;

const menu = (id: string, parentOfferProductId: string | null = null, isComponent = false): Product => ({
  id,
  name: id,
  description: '',
  basePrice: 10,
  isActive: true,
  isAvailable: true,
  type: 'menu',
  imageUrl: null,
  images: [],
  isComponent,
  parentOfferProductId,
});

describe('useLinkExistingMenuLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('excludes components and menus that already anchor alternatives', async () => {
    mockGetAllProducts.mockResolvedValue([
      menu('standalone'),
      menu('component', null, true),
      menu('anchor'),
      menu('anchored-child', 'anchor'),
      menu('current', 'parent-1'),
    ]);

    const { result } = renderHook(() => useLinkExistingMenuLoader({ isOpen: true, productId: 'current' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.bundles.map((candidate) => candidate.id)).toEqual(['standalone', 'anchored-child']);
    expect(result.current.bundles.some((candidate) => candidate.isComponent)).toBe(false);
  });

  it('ignores a response after the modal closes', async () => {
    let resolve!: (items: Product[]) => void;
    mockGetAllProducts.mockReturnValue(new Promise((promiseResolve) => (resolve = promiseResolve)));
    const { result, rerender } = renderHook(({ isOpen }) => useLinkExistingMenuLoader({ isOpen, productId: 'p1' }), {
      initialProps: { isOpen: true },
    });

    rerender({ isOpen: false });
    resolve([menu('late')]);
    await Promise.resolve();
    expect(result.current.bundles).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('does not load candidates when the current menu is not an eligible parent', async () => {
    const { result } = renderHook(() =>
      useLinkExistingMenuLoader({ isOpen: true, productId: 'linked-menu', parentEligible: false }),
    );

    expect(result.current.bundles).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(mockGetAllProducts).not.toHaveBeenCalled();
  });
});
