import { apiClient } from '@/utils/apiClient';
import { linkMenuOffer, unlinkMenuOffer } from './menuOfferFamilyService';

jest.mock('@/utils/apiClient', () => ({
  apiClient: { patch: jest.fn(), delete: jest.fn() },
}));

describe('menuOfferFamilyService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the narrow PATCH relationship endpoint with only parent ids in the body', async () => {
    (apiClient.patch as jest.Mock).mockResolvedValue({ success: true });

    await linkMenuOffer('menu-1', {
      parentOfferProductId: 'product-1',
      parentOfferVariationId: 'variation-1',
    });

    expect(apiClient.patch).toHaveBeenCalledWith('/api/Menus/menu-1/offer-parent', {
      parentOfferProductId: 'product-1',
      parentOfferVariationId: 'variation-1',
    });
  });

  it('clears only the relationship through DELETE', async () => {
    (apiClient.delete as jest.Mock).mockResolvedValue({ success: true });

    await unlinkMenuOffer('menu-1');

    expect(apiClient.delete).toHaveBeenCalledWith('/api/Menus/menu-1/offer-parent');
  });
});
