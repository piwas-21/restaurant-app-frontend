import { loadVisiblePages, type PublicPagedItems } from './loadVisiblePages';

type Item = { id: string; isActive?: boolean; isAvailable?: boolean };

function response(items: Item[], page: number, totalPages: number, totalCount: number): PublicPagedItems<Item> {
  return { success: true, data: { items, page, pageSize: 2, totalPages, totalCount } };
}

describe('loadVisiblePages', () => {
  it('loads later pages, excludes unavailable rows consistently, and derives visible pages', async () => {
    const fetchPage = jest.fn(async (page: number) =>
      page === 1
        ? response([{ id: 'a' }, { id: 'sold-out', isAvailable: false }], 1, 2, 3)
        : response([{ id: 'b' }], 2, 2, 3),
    );

    const result = await loadVisiblePages(fetchPage, 2, 2);

    expect(result).toMatchObject({ currentPage: 1, totalPages: 1, totalCount: 2, items: [{ id: 'a' }, { id: 'b' }] });
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('accepts a verified empty collection with the backend zero-page shape', async () => {
    const result = await loadVisiblePages(async () => response([], 1, 0, 0), 1, 2);
    expect(result).toMatchObject({ currentPage: 1, totalPages: 1, totalCount: 0, allItems: [] });
  });

  it('fails closed when the backend repeats the first page', async () => {
    await expect(
      loadVisiblePages(async () => response([{ id: 'same' }, { id: 'same' }], 1, 2, 4), 1, 2),
    ).rejects.toThrow('incomplete or repeated pages');
  });

  it('fails closed for a full page with missing pagination evidence', async () => {
    await expect(
      loadVisiblePages(async () => ({ success: true, data: { items: [{ id: 'a' }, { id: 'b' }] } }), 1, 2),
    ).rejects.toThrow('verified pagination limit');
  });
});
