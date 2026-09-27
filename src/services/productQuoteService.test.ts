import { apiClient } from '@/utils/apiClient';
import { quoteProduct } from './productQuoteService';
import { OrderType } from '@/types/order';

jest.mock('@/utils/apiClient', () => ({
  ...jest.requireActual('@/utils/apiClient'),
  apiClient: { post: jest.fn() },
}));

const mockPost = apiClient.post as jest.Mock;

describe('quoteProduct', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends a selected bundle configuration to the basket-equivalent quote route', async () => {
    const data = { productId: 'menu-id', quantity: 2, unitPrice: 18.5, totalPrice: 37 };
    mockPost.mockResolvedValue({ success: true, data });
    const request = {
      quantity: 2,
      selectedMenuOptions: [
        {
          sectionId: 'section-id',
          itemId: 'item-id',
          productVariationId: 'variation-id',
          quantity: 1,
          selectedIngredients: ['ingredient-id'],
          ingredientQuantities: { 'ingredient-id': 1 },
          customizationSelections: [
            { groupId: 'group-id', options: [{ kind: 1 as const, optionId: 'option-id', quantity: 1 }] },
          ],
        },
      ],
    };

    await expect(quoteProduct('menu-id', request, OrderType.Takeaway)).resolves.toEqual(data);
    expect(mockPost).toHaveBeenCalledWith('/api/Products/menu-id/quote?requestedOrderType=Takeaway', request, {
      requireAuth: true,
    });
  });

  it('omits the channel query when no order type is selected', async () => {
    mockPost.mockResolvedValue({
      success: true,
      data: { productId: 'item-id', quantity: 1, unitPrice: 5, totalPrice: 5 },
    });

    await quoteProduct('item-id', { quantity: 1 });

    expect(mockPost).toHaveBeenCalledWith('/api/Products/item-id/quote', { quantity: 1 }, { requireAuth: true });
  });

  it('surfaces an unsuccessful envelope as an API refusal', async () => {
    mockPost.mockResolvedValue({ success: false, message: 'Required option missing', errors: ['Choose a drink'] });

    await expect(quoteProduct('menu-id', { quantity: 1 })).rejects.toMatchObject({
      message: 'Required option missing',
      errors: ['Choose a drink'],
    });
  });
});
