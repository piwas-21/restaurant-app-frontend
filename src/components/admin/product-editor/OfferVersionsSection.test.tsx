import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OfferVersionsSection from './OfferVersionsSection';
import { getProducts } from '@/services/menuService';
import { linkMenuOffer, unlinkMenuOffer } from '@/services/menuOfferFamilyService';
import type { ProductDetails, Product } from '@/app/admin/menu-management/interfaces';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/menuService', () => ({ getProducts: jest.fn() }));
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

const bundle = (id: string, parentOfferProductId?: string): Product => ({
  id,
  name: id,
  description: '',
  basePrice: 12,
  isActive: true,
  isAvailable: true,
  type: 'menu',
  imageUrl: null,
  images: [],
  parentOfferProductId,
});

const page = (items: Product[]) => ({
  success: true,
  message: '',
  data: { items, totalCount: items.length, totalPages: 1, page: 1, pageSize: 100 },
  errors: null,
});

describe('OfferVersionsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getProducts as jest.Mock).mockResolvedValue(page([bundle('menu-1', 'product-1'), bundle('menu-2')]));
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

    fireEvent.click(screen.getByRole('button', { name: 'menu_bundles' }));
    await waitFor(() => expect(getProducts).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'menu-2' } });
    expect(screen.getByText(/preview: Tacos 1 Viande · menu-2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'yes' }));
    await waitFor(() => expect(unlinkMenuOffer).toHaveBeenCalledWith('menu-1'));
  });
});
