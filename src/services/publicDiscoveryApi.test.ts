/** @jest-environment node */

import { readPublicCollection } from './publicDiscoveryApi';

const fetchMock: jest.MockedFunction<typeof fetch> = jest.fn();
const originalFetch = global.fetch;
const originalApiBase = process.env.API_INTERNAL_URL;

function page(items: Array<{ id: string }>, values: Record<string, unknown> = {}) {
  return {
    success: true,
    data: { items, ...values },
  };
}

function response(data: unknown): Response {
  return {
    ok: true,
    json: async () => data,
  } as Response;
}

beforeEach(() => {
  process.env.API_INTERNAL_URL = 'https://tenant-api.example';
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

afterEach(() => {
  global.fetch = originalFetch;
  if (originalApiBase === undefined) delete process.env.API_INTERNAL_URL;
  else process.env.API_INTERNAL_URL = originalApiBase;
});

describe('readPublicCollection', () => {
  it('fails closed on a full page without pagination metadata', async () => {
    fetchMock.mockResolvedValueOnce(response(page([{ id: 'p1' }, { id: 'p2' }])));

    const result = await readPublicCollection<{ id: string }>(() => '/api/products', 2, 5);

    expect(result).toMatchObject({ complete: false, totalPages: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('accepts the backend zero-count, zero-page empty collection', async () => {
    fetchMock.mockResolvedValueOnce(
      response(
        page([], {
          page: 1,
          pageSize: 200,
          totalPages: 0,
          totalCount: 0,
        }),
      ),
    );

    await expect(readPublicCollection<{ id: string }>(() => '/api/bundles', 200, 20)).resolves.toEqual({
      complete: true,
      items: [],
      totalPages: 0,
      totalCount: 0,
    });
  });

  it('loads each verified page and rejects duplicate identities', async () => {
    fetchMock
      .mockResolvedValueOnce(
        response(
          page([{ id: 'p1' }, { id: 'p2' }], {
            page: 1,
            pageSize: 2,
            totalPages: 2,
            totalCount: 4,
          }),
        ),
      )
      .mockResolvedValueOnce(
        response(
          page([{ id: 'p2' }, { id: 'p4' }], {
            page: 2,
            pageSize: 2,
            totalPages: 2,
            totalCount: 4,
          }),
        ),
      );

    const result = await readPublicCollection<{ id: string }>((number) => `/api/products?page=${number}`, 2, 5);

    expect(result).toMatchObject({ complete: false, totalPages: 2, totalCount: 4 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://tenant-api.example/api/products?page=1',
      'https://tenant-api.example/api/products?page=2',
    ]);
  });

  it('confirms complete collections across multiple pages with stable unique IDs', async () => {
    fetchMock
      .mockResolvedValueOnce(
        response(
          page([{ id: 'p1' }, { id: 'p2' }], {
            page: 1,
            pageSize: 2,
            totalPages: 2,
            totalCount: 3,
          }),
        ),
      )
      .mockResolvedValueOnce(
        response(
          page([{ id: 'p3' }], {
            page: 2,
            pageSize: 2,
            totalPages: 2,
            totalCount: 3,
          }),
        ),
      );

    const result = await readPublicCollection<{ id: string }>((number) => `/api/products?page=${number}`, 2, 5);

    expect(result).toMatchObject({ complete: true, totalPages: 2, totalCount: 3 });
    expect(result.items.map(({ id }) => id)).toEqual(['p1', 'p2', 'p3']);
  });
});
