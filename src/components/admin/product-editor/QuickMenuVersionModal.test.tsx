import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import QuickMenuVersionModal from './QuickMenuVersionModal';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { productName?: string }) =>
      key === 'suggested_menu_version_name' ? `Menu ${values?.productName ?? ''}` : key,
    i18n: { language: 'en' },
  }),
}));

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
    render(<QuickMenuVersionModal isOpen product={product} onClose={jest.fn()} onCreateRequested={jest.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent('menu_version_prefill_warning');
    expect(screen.getByRole('button', { name: 'continue_to_bundle_editor' })).toBeDisabled();
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
  });

  it('rejects invalid price and missing variation through the handoff schema', async () => {
    render(<QuickMenuVersionModal isOpen product={product} onClose={jest.fn()} onCreateRequested={jest.fn()} />);
    const price = screen.getByRole('spinbutton');
    const variation = screen.getByRole('combobox', { name: 'product_variations' });

    await act(async () => {
      fireEvent.change(price, { target: { value: '0' } });
    });

    expect(price).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('admin_edit_price_invalid')).toBeInTheDocument();
    expect(variation).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'continue_to_bundle_editor' })).toBeDisabled();
  });

  it('rejects the handoff until every confirmation field passes the schema', () => {
    render(<QuickMenuVersionModal isOpen product={product} onClose={jest.fn()} onCreateRequested={jest.fn()} />);

    const confirmations = screen.getAllByRole('checkbox');

    confirmations.forEach((confirmation) => {
      expect(confirmation).toHaveAttribute('aria-invalid', 'true');
    });
    expect(screen.getAllByRole('alert')).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'continue_to_bundle_editor' })).toBeDisabled();
  });

  it('keeps the generated name editable and validates the backend length limit', async () => {
    render(<QuickMenuVersionModal isOpen product={product} onClose={jest.fn()} onCreateRequested={jest.fn()} />);
    const name = screen.getByRole('textbox', { name: 'menu_bundle_name' });

    expect(name).toHaveValue('Menu Tacos 1 Viande');
    await act(async () => {
      fireEvent.change(name, { target: { value: '' } });
    });
    expect(screen.getByText('menu_bundle_name_required')).toBeInTheDocument();
    await act(async () => {
      fireEvent.change(name, { target: { value: 'x'.repeat(101) } });
    });
    expect(screen.getByText('menu_bundle_name_too_long')).toBeInTheDocument();
    expect(name).toHaveAttribute('maxLength', '100');
  });

  it('routes a linked menu prefill to the full editor without creating a record', async () => {
    const onCreateRequested = jest.fn();
    render(
      <QuickMenuVersionModal isOpen product={product} onClose={jest.fn()} onCreateRequested={onCreateRequested} />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'product_variations' }), {
      target: { value: 'variation-1' },
    });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '13' } });
    confirmAll();
    fireEvent.change(screen.getByRole('textbox', { name: 'menu_bundle_name' }), {
      target: { value: 'Menu Tacos XL' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'continue_to_bundle_editor' }));

    await waitFor(() => expect(onCreateRequested).toHaveBeenCalledTimes(1));
    const prefill = onCreateRequested.mock.calls[0][0];
    expect(prefill.name).toBe('Menu Tacos XL');
    expect(prefill.categories).toEqual([{ categoryId: 'cat-1', categoryName: 'Tacos', isPrimary: true }]);
    expect(prefill.content).toEqual({ en: { name: 'Menu Tacos XL', description: 'Tacos' } });
    expect(prefill.menuDefinition.parentOfferProductId).toBe('product-1');
    expect(prefill.menuDefinition.parentOfferVariationId).toBe('variation-1');
    expect(prefill.menuDefinition.sections[0].items[0]).toEqual(
      expect.objectContaining({ productId: 'product-1', productVariationId: 'variation-1' }),
    );
    expect(prefill.basePrice).toBe(13);
  });

  it('filters inactive variations and requires an active choice', () => {
    const inactiveOnly = { ...product, variations: [{ ...product.variations[0], isActive: false }] };
    render(<QuickMenuVersionModal isOpen product={inactiveOnly} onClose={jest.fn()} onCreateRequested={jest.fn()} />);

    expect(screen.getByRole('option', { name: 'select_product' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Large/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'continue_to_bundle_editor' })).toBeDisabled();
  });

  it('carries source channel and allergen state into the full editor prefill', async () => {
    const onCreateRequested = jest.fn();
    const source = { ...product, isActive: false, isAvailable: false, allergens: ['gluten', 'milk'] };
    render(<QuickMenuVersionModal isOpen product={source} onClose={jest.fn()} onCreateRequested={onCreateRequested} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'product_variations' }), {
      target: { value: 'variation-1' },
    });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '13' } });
    confirmAll();
    fireEvent.click(screen.getByRole('button', { name: 'continue_to_bundle_editor' }));

    await waitFor(() => expect(onCreateRequested).toHaveBeenCalledTimes(1));
    expect(onCreateRequested.mock.calls[0][0]).toMatchObject({
      isActive: false,
      isAvailable: false,
      allergens: ['gluten', 'milk'],
    });
  });
});
