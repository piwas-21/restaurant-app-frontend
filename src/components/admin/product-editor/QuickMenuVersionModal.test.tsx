import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import QuickMenuVersionModal from './QuickMenuVersionModal';
import { createMenuBundle } from '@/services/menuBundleService';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
jest.mock('@/services/menuBundleService', () => ({ createMenuBundle: jest.fn() }));

const product: ProductDetails = {
  id: 'product-1',
  name: 'Tacos 1 Viande',
  description: 'Tacos',
  basePrice: 9,
  isActive: true,
  isAvailable: true,
  preparationTimeMinutes: 8,
  type: 'mainItem',
  ingredients: [],
  allergens: [],
  categories: [{ categoryId: 'cat-1', categoryName: 'Tacos', isPrimary: true }],
  primaryCategory: { id: 'cat-1', name: 'Tacos' },
  variations: [{ id: 'variation-1', name: 'Large', priceModifier: 2, finalPrice: 11, isActive: true }],
  images: [],
  suggestedSideItems: [],
};

const confirmAll = () => {
  screen.getAllByRole('checkbox').forEach((checkbox) => fireEvent.click(checkbox));
};

describe('QuickMenuVersionModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires explicit confirmation of sections, price, categories, schedule and channels', () => {
    render(<QuickMenuVersionModal isOpen product={product} onClose={jest.fn()} onCreated={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'create_menu_bundle' })).toBeDisabled();
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
  });

  it('creates a linked menu from the existing product and selected variation', async () => {
    (createMenuBundle as jest.Mock).mockResolvedValue({ success: true, data: { id: 'menu-1' } });
    const onCreated = jest.fn();
    render(<QuickMenuVersionModal isOpen product={product} onClose={jest.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'product_variations' }), {
      target: { value: 'variation-1' },
    });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '13' } });
    confirmAll();
    fireEvent.click(screen.getByRole('button', { name: 'create_menu_bundle' }));

    await waitFor(() => expect(createMenuBundle).toHaveBeenCalledTimes(1));
    const payload = (createMenuBundle as jest.Mock).mock.calls[0][0];
    expect(payload.categoryIds).toEqual(['cat-1']);
    expect(payload.content).toEqual({ en: { name: 'Tacos 1 Viande', description: 'Tacos' } });
    expect(payload.menuDefinition.parentOfferProductId).toBe('product-1');
    expect(payload.menuDefinition.parentOfferVariationId).toBe('variation-1');
    expect(payload.menuDefinition.sections[0].items[0]).toEqual(
      expect.objectContaining({ productId: 'product-1', productVariationId: 'variation-1' }),
    );
    expect(payload.basePrice).toBe(13);
    expect(onCreated).toHaveBeenCalledWith('menu-1');
  });
});
