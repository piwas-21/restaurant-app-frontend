import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OfferFamilyChoiceModal from './OfferFamilyChoiceModal';
import type { CatalogOfferFamily } from '@/types/menu/offerFamily';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: unknown) =>
      typeof fallback === 'string'
        ? fallback
        : ((
            {
              cancel: 'Cancel',
              continue: 'Continue',
              close: 'Close',
              offer_family_item_only: 'Item only',
              offer_family_menu: 'Menu',
              offer_family_choose_size: 'Choose a size',
              offer_family_choose_mode: 'How would you like it?',
            } as Record<string, string>
          )[key] ?? key),
  }),
}));

const family: CatalogOfferFamily = {
  id: 'family-tacos',
  anchor: {
    kind: 'product',
    id: 'tacos',
    name: 'Tacos 1 Viande',
    price: 9,
    isBundle: false,
    content: { en: { name: 'Tacos 1 Viande' } },
  },
  menuOffers: [
    {
      productId: 'menu-tacos',
      kind: 'bundle',
      name: 'Menu Tacos 1 Viande',
      price: 13,
      parentVariationId: 'large',
    },
  ],
  categoryIds: ['tacos'],
  startingPrice: 9,
  variationOptions: [
    { id: 'small', name: 'Small', price: 9 },
    { id: 'large', name: 'Large', price: 12 },
  ],
};

describe('OfferFamilyChoiceModal', () => {
  it('uses the localized anchor content as the modal title', () => {
    render(
      <OfferFamilyChoiceModal
        family={{
          ...family,
          anchor: { ...family.anchor, name: 'Fallback title', content: { en: { name: 'Localized title' } } },
        }}
        onClose={jest.fn()}
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Localized title' })).toBeInTheDocument();
  });

  it('projects a selected size onto the item target and passes it to the next sheet', async () => {
    const onSelect = jest.fn();
    render(<OfferFamilyChoiceModal family={family} onClose={jest.fn()} onSelect={onSelect} />);

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Small' })).toBeChecked());
    fireEvent.click(screen.getByRole('radio', { name: 'Large' }));

    expect(screen.getByRole('radio', { name: 'Item only CHF 12.00' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Menu CHF 13.00' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'menu-tacos', kind: 'bundle', price: 13 }),
    );
  });

  it('passes the chosen item size when the guest continues with item only', async () => {
    const onSelect = jest.fn();
    render(<OfferFamilyChoiceModal family={family} onClose={jest.fn()} onSelect={onSelect} />);

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Small' })).toBeChecked());
    fireEvent.click(screen.getByRole('radio', { name: 'Large' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'tacos', kind: 'product', parentVariationId: 'large', price: 12 }),
    );
  });

  it('disables a linked menu outside its configured schedule', async () => {
    render(
      <OfferFamilyChoiceModal
        family={{ ...family, menuOffers: [{ ...family.menuOffers[0], scheduleAvailable: false }] }}
        onClose={jest.fn()}
        onSelect={jest.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Small' })).toBeChecked());
    fireEvent.click(screen.getByRole('radio', { name: 'Large' }));
    expect(screen.getByRole('radio', { name: 'Menu CHF 13.00' })).toBeDisabled();
  });

  it('disables an inactive target even when its schedule and channel allow ordering', async () => {
    render(
      <OfferFamilyChoiceModal
        family={{ ...family, anchor: { ...family.anchor, isActive: false } }}
        onClose={jest.fn()}
        onSelect={jest.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Small' })).toBeChecked());
    expect(screen.getByRole('radio', { name: 'Item only CHF 9.00' })).toBeDisabled();
  });

  it('offers only targets matching an active allergen filter', async () => {
    render(
      <OfferFamilyChoiceModal
        family={{
          ...family,
          anchor: { ...family.anchor, allergens: ['gluten'] },
          menuOffers: [{ ...family.menuOffers[0], allergens: ['vegan'] }],
        }}
        activeFilterIds={new Set(['claim:vegan'])}
        onClose={jest.fn()}
        onSelect={jest.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Small' })).toBeChecked());
    fireEvent.click(screen.getByRole('radio', { name: 'Large' }));
    expect(screen.queryByRole('radio', { name: /Item only/ })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Menu CHF 13.00' })).toBeInTheDocument();
  });

  it('shows only the exact variation menu and keeps the anchor separate', async () => {
    const familyWithVariationMenus: CatalogOfferFamily = {
      ...family,
      id: 'family-chicken-pieces',
      anchor: { ...family.anchor, id: 'chicken', name: 'Chicken', price: 10 },
      menuOffers: [
        { productId: 'menu-chicken-base', kind: 'bundle', name: 'Base menu', price: 14, parentVariationId: null },
        { productId: 'menu-chicken-six', kind: 'bundle', name: '6-piece menu', price: 15, parentVariationId: 'six' },
        {
          productId: 'menu-chicken-twelve',
          kind: 'bundle',
          name: '12-piece menu',
          price: 18,
          parentVariationId: 'twelve',
        },
      ],
      variationOptions: [
        { id: 'six', name: '6 pieces', price: 10 },
        { id: 'twelve', name: '12 pieces', price: 14 },
      ],
    };

    render(<OfferFamilyChoiceModal family={familyWithVariationMenus} onClose={jest.fn()} onSelect={jest.fn()} />);

    await waitFor(() => expect(screen.getByRole('radio', { name: '6 pieces' })).toBeChecked());
    expect(screen.getByRole('radio', { name: 'Item only CHF 10.00' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Menu CHF 15.00' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Menu CHF 14.00' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Menu CHF 18.00' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: '12 pieces' }));

    expect(screen.getByRole('radio', { name: 'Item only CHF 14.00' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Menu CHF 18.00' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Menu CHF 14.00' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Menu CHF 15.00' })).not.toBeInTheDocument();
  });

  it('shows the base menu only when no variation is selected', async () => {
    const familyWithBaseMenu: CatalogOfferFamily = {
      ...family,
      id: 'family-base-menu',
      menuOffers: [
        { productId: 'menu-base', kind: 'bundle', name: 'Base menu', price: 14, parentVariationId: null },
        { productId: 'menu-six', kind: 'bundle', name: '6-piece menu', price: 15, parentVariationId: 'six' },
      ],
      variationOptions: [],
    };

    render(<OfferFamilyChoiceModal family={familyWithBaseMenu} onClose={jest.fn()} onSelect={jest.fn()} />);

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Menu CHF 14.00' })).toBeInTheDocument());
    expect(screen.queryByRole('radio', { name: 'Menu CHF 15.00' })).not.toBeInTheDocument();
  });
});
