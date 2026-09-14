import { getProducts } from '@/services/menuService';
import { loadAllCustomizationProducts } from './useCustomizationProductOptions';

jest.mock('@/services/menuService', () => ({ getProducts: jest.fn() }));

const mockedGetProducts = getProducts as jest.MockedFunction<typeof getProducts>;
const response = (page: number, totalPages: number, names: string[] = []) => ({
  success: true,
  message: '',
  errors: null,
  data: {
    items: names.map((name) => ({ id: name, name })),
    totalCount: names.length,
    page,
    pageSize: 10,
    totalPages,
  },
});

describe('loadAllCustomizationProducts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads every server-declared page using the returned page size', async () => {
    mockedGetProducts
      .mockResolvedValueOnce(response(1, 3, ['one']) as never)
      .mockResolvedValueOnce(response(2, 3, ['two']) as never)
      .mockResolvedValueOnce(response(3, 3, ['three']) as never);

    await expect(loadAllCustomizationProducts()).resolves.toEqual([
      expect.objectContaining({ id: 'one' }),
      expect.objectContaining({ id: 'two' }),
      expect.objectContaining({ id: 'three' }),
    ]);
    expect(mockedGetProducts).toHaveBeenNthCalledWith(2, 2, 10, null, { includeComponents: true });
    expect(mockedGetProducts).toHaveBeenNthCalledWith(3, 3, 10, null, { includeComponents: true });
  });

  it('returns an empty catalogue and propagates load failures', async () => {
    mockedGetProducts.mockResolvedValueOnce(response(1, 1) as never);
    await expect(loadAllCustomizationProducts()).resolves.toEqual([]);

    mockedGetProducts.mockRejectedValueOnce(new Error('offline'));
    await expect(loadAllCustomizationProducts()).rejects.toThrow('offline');
  });
});
