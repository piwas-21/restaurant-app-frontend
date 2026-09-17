import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OfferVersionsSection from './OfferVersionsSection';
import { getAllMenuBundles } from '@/services/menuService';
import { linkMenuOffer, unlinkMenuOffer } from '@/services/menuOfferFamilyService';
import type { ProductDetails, Product } from '@/app/admin/menu-management/interfaces';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/menuService', () => ({ getAllMenuBundles: jest.fn() }));
jest.mock('@/services/menuOfferFamilyService', () => ({ linkMenuOffer: jest.fn(), unlinkMenuOffer: jest.fn() }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));

const parent: ProductDetails = {
  id: 'product-1',
  name: 'Tacos 1 Viande',
  description: '',
  basePrice: 9,
  isActive: true,
  isAvailable: true,
  preparationTimeMinutes: 0,
  type: 'mainItem',
  ingredients: [],
  allergens: [],
  categories: [],
  variations: [],
  images: [],
  suggestedSideItems: [],
};

const bundle = (id: string, parentOfferProductId?: string, categoryNames: string[] = []): Product => ({
  id,
  name: id,
  description: '',
  basePrice: 12,
  isActive: true,
  isAvailable: true,
  type: 'menu',
  imageUrl: null,
  images: [],
  categoryNames,
  parentOfferProductId,
});

describe('OfferVersionsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAllMenuBundles as jest.Mock).mockResolvedValue([
      bundle('menu-1', 'product-1', ['Tacos']),
      bundle('menu-2', undefined, ['Drinks']),
    ]);
    (linkMenuOffer as jest.Mock).mockResolvedValue({ success: true });
    (unlinkMenuOffer as jest.Mock).mockResolvedValue({ success: true });
  });

  it('shows linked offers with direct detail links and excludes unrelated bundles', async () => {
    render(<OfferVersionsSection product={parent} />);

    await waitFor(() => expect(screen.getByText('menu-1')).toBeInTheDocument());
    expect(screen.queryByText('menu-2')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'details' })).toHaveAttribute('href', '/admin/menu-management/menu-1');
  });

  it('previews and links an existing menu through the narrow relation command', async () => {
    render(<OfferVersionsSection product={parent} />);
    await waitFor(() => expect(screen.getByText('menu-1')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'link_existing_menu_version' }));
    await waitFor(() => expect(getAllMenuBundles).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'menu-2' } });
    expect(screen.getByText(/preview: Tacos 1 Viande · menu-2/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('category_mismatch_warning');
    fireEvent.click(screen.getByRole('button', { name: 'link_menu_version' }));

    await waitFor(() =>
      expect(linkMenuOffer).toHaveBeenCalledWith('menu-2', {
        menuProductId: 'menu-2',
        parentOfferProductId: 'product-1',
        parentOfferVariationId: null,
      }),
    );
  });

  it('unlinks without deleting the underlying menu', async () => {
    render(<OfferVersionsSection product={parent} />);
    await waitFor(() => expect(screen.getByText('menu-1')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'unlink_menu_version' }));
    expect(screen.getByText('unlink_menu_version_confirmation')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'yes' }));
    await waitFor(() => expect(unlinkMenuOffer).toHaveBeenCalledWith('menu-1'));
  });

  it('requires an active variation before linking a menu version', async () => {
    const variedParent = {
      ...parent,
      variations: [
        { id: 'active-1', name: 'Large', priceModifier: 1, finalPrice: 10, isActive: true },
        { id: 'inactive-1', name: 'Old', priceModifier: 0, finalPrice: 9, isActive: false },
      ],
    };
    render(<OfferVersionsSection product={variedParent} />);

    await waitFor(() => expect(screen.getByText('menu-1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'link_existing_menu_version' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'product_variations' })).toBeInTheDocument());

    expect(screen.queryByRole('option', { name: 'Old' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'menu_bundles' }), { target: { value: 'menu-2' } });
    expect(screen.getByRole('button', { name: 'link_menu_version' })).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox', { name: 'product_variations' }), { target: { value: 'active-1' } });
    expect(screen.getByRole('button', { name: 'link_menu_version' })).not.toBeDisabled();
  });

  it('keeps standalone bundles linkable while omitting bundle-to-bundle quick cloning', async () => {
    render(<OfferVersionsSection product={{ ...parent, type: 'menu' }} allowQuickCreate={false} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'link_existing_menu_version' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'create_menu_version' })).not.toBeInTheDocument();
  });
});
