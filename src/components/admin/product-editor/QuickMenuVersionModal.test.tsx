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

    expect(screen.getByRole('button', { name: 'create_menu_version' })).toBeDisabled();
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
  });

  it('keeps the generated name editable and validates the backend length limit', () => {
    render(<QuickMenuVersionModal isOpen product={product} onClose={jest.fn()} onCreated={jest.fn()} />);
    const name = screen.getByRole('textbox', { name: 'menu_bundle_name' });

    fireEvent.change(name, { target: { value: '' } });
    expect(screen.getByText('menu_bundle_name_required')).toBeInTheDocument();
    fireEvent.change(name, { target: { value: 'x'.repeat(101) } });
    expect(screen.getByText('menu_bundle_name_too_long')).toBeInTheDocument();
    expect(name).toHaveAttribute('maxLength', '100');
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
    fireEvent.change(screen.getByRole('textbox', { name: 'menu_bundle_name' }), {
      target: { value: 'Menu Tacos XL' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'create_menu_version' }));

    await waitFor(() => expect(createMenuBundle).toHaveBeenCalledTimes(1));
    const payload = (createMenuBundle as jest.Mock).mock.calls[0][0];
    expect(payload.categoryIds).toEqual(['cat-1']);
    expect(payload.content).toEqual({ en: { name: 'Menu Tacos XL', description: 'Tacos' } });
    expect(payload.menuDefinition.parentOfferProductId).toBe('product-1');
    expect(payload.menuDefinition.parentOfferVariationId).toBe('variation-1');
    expect(payload.menuDefinition.sections[0].items[0]).toEqual(
      expect.objectContaining({ productId: 'product-1', productVariationId: 'variation-1' }),
    );
    expect(payload.basePrice).toBe(13);
    expect(onCreated).toHaveBeenCalledWith('menu-1');
  });

  it('filters inactive variations and requires an active choice', () => {
    const inactiveOnly = { ...product, variations: [{ ...product.variations[0], isActive: false }] };
    render(<QuickMenuVersionModal isOpen product={inactiveOnly} onClose={jest.fn()} onCreated={jest.fn()} />);

    expect(screen.getByRole('option', { name: 'select_product' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Large/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'create_menu_version' })).toBeDisabled();
  });

  it('preserves source visibility and allergen state in the new menu', async () => {
    (createMenuBundle as jest.Mock).mockResolvedValue({ success: true, data: { id: 'menu-2' } });
    const source = { ...product, isActive: false, isAvailable: false, allergens: ['gluten', 'milk'] };
    render(<QuickMenuVersionModal isOpen product={source} onClose={jest.fn()} onCreated={jest.fn()} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'product_variations' }), {
      target: { value: 'variation-1' },
    });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '13' } });
    confirmAll();
    fireEvent.click(screen.getByRole('button', { name: 'create_menu_version' }));

    await waitFor(() => expect(createMenuBundle).toHaveBeenCalledTimes(1));
    expect((createMenuBundle as jest.Mock).mock.calls[0][0]).toMatchObject({
      isActive: false,
      isAvailable: false,
      allergens: ['gluten', 'milk'],
    });
  });
});
