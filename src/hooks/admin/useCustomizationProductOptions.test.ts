import { searchProducts } from '@/services/productService';
import { loadCustomizationProducts } from './useCustomizationProductOptions';

jest.mock('@/services/productService', () => ({ searchProducts: jest.fn() }));

const mockedSearchProducts = searchProducts as jest.MockedFunction<typeof searchProducts>;
const response = (names: string[] = []) => ({
  success: true,
  message: '',
  errors: null,
  data: {
    items: names.map((name) => ({ id: name, name })),
    totalCount: names.length,
  },
});

describe('loadCustomizationProducts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses bounded server search and includes component products', async () => {
    mockedSearchProducts.mockResolvedValueOnce(response(['one']) as never);

    await expect(loadCustomizationProducts('kebab')).resolves.toEqual([expect.objectContaining({ id: 'one' })]);
    expect(mockedSearchProducts).toHaveBeenCalledWith('kebab', { includeComponents: true });
  });

  it('returns an empty result and propagates load failures', async () => {
    mockedSearchProducts.mockResolvedValueOnce(response() as never);
    await expect(loadCustomizationProducts('')).resolves.toEqual([]);

    mockedSearchProducts.mockRejectedValueOnce(new Error('offline'));
    await expect(loadCustomizationProducts('meat')).rejects.toThrow('offline');
  });
});
