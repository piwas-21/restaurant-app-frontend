import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import OfferVersionsSection from './OfferVersionsSection';
import { getAllMenuBundles, getAllProducts } from '@/services/menuService';
import { linkMenuOffer, unlinkMenuOffer } from '@/services/menuOfferFamilyService';
import type { ProductDetails, Product } from '@/app/admin/menu-management/interfaces';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/menuService', () => ({ getAllMenuBundles: jest.fn(), getAllProducts: jest.fn() }));
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
      bundle('menu-2', 'owner-2', ['Drinks']),
    ]);
    (getAllProducts as jest.Mock).mockResolvedValue([
      bundle('menu-1', 'product-1', ['Tacos']),
      bundle('menu-2', 'owner-2', ['Drinks']),
      { ...parent, id: 'owner-2', name: 'Other product' },
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
    await waitFor(() => expect(getAllProducts).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'menu-2' } });
    expect(screen.getByText(/preview: Tacos 1 Viande · menu-2/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('category_mismatch_warning');
    expect(screen.getByRole('status')).toHaveTextContent('current_menu_parent');
    fireEvent.click(screen.getByRole('button', { name: 'link_menu_version' }));
    expect(screen.getByText('reassign_menu_confirmation')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'yes' }));

    await waitFor(() =>
      expect(linkMenuOffer).toHaveBeenCalledWith('menu-2', {
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
    await waitFor(() => expect(getAllMenuBundles).toHaveBeenCalledTimes(2));
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

  it('does not let a linked menu become an offer-family parent', () => {
    const linkedMenu = {
      ...parent,
      type: 'menu',
      menuDefinition: {
        id: 'definition-1',
        parentOfferProductId: 'owner-1',
        parentOfferVariationId: null,
        isAlwaysAvailable: true,
        availableMonday: true,
        availableTuesday: true,
        availableWednesday: true,
        availableThursday: true,
        availableFriday: true,
        availableSaturday: true,
        availableSunday: true,
        sections: [],
      },
    };

    const { container } = render(<OfferVersionsSection product={linkedMenu} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('ignores a stale bundle-list response after the parent product changes', async () => {
    let resolveFirst: ((value: Product[]) => void) | undefined;
    let resolveSecond: ((value: Product[]) => void) | undefined;
    (getAllMenuBundles as jest.Mock)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );
    const { rerender } = render(<OfferVersionsSection product={parent} />);
    rerender(<OfferVersionsSection product={{ ...parent, id: 'owner-2', name: 'Other product' }} />);

    await act(async () => {
      resolveSecond?.([bundle('menu-2', 'owner-2')]);
    });
    await waitFor(() => expect(screen.getByText('menu-2')).toBeInTheDocument());
    await act(async () => {
      resolveFirst?.([bundle('menu-1', 'product-1')]);
    });
    expect(screen.queryByText('menu-1')).not.toBeInTheDocument();
  });

  it('does not send duplicate unlink requests while the first one is pending', async () => {
    let resolveUnlink: ((value: { success: boolean }) => void) | undefined;
    (unlinkMenuOffer as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUnlink = resolve;
        }),
    );
    render(<OfferVersionsSection product={parent} />);
    await waitFor(() => expect(screen.getByText('menu-1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'unlink_menu_version' }));
    fireEvent.click(screen.getByRole('button', { name: 'yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'yes' }));
    expect(unlinkMenuOffer).toHaveBeenCalledTimes(1);
    await waitFor(async () => {
      await act(async () => {
        resolveUnlink?.({ success: true });
      });
      expect(unlinkMenuOffer).toHaveBeenCalledTimes(1);
    });
  });

  it('does not update state when an unlink resolves after unmount', async () => {
    let resolveUnlink: ((value: { success: boolean }) => void) | undefined;
    (unlinkMenuOffer as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUnlink = resolve;
        }),
    );
    const { unmount } = render(<OfferVersionsSection product={parent} />);
    await waitFor(() => expect(screen.getByText('menu-1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'unlink_menu_version' }));
    fireEvent.click(screen.getByRole('button', { name: 'yes' }));
    unmount();

    await act(async () => {
      resolveUnlink?.({ success: true });
      await Promise.resolve();
    });
    expect(unlinkMenuOffer).toHaveBeenCalledTimes(1);
  });
});
