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
              offer_family_meal: 'Meal',
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
  it('projects a selected size onto the item target and passes it to the next sheet', async () => {
    const onSelect = jest.fn();
    render(<OfferFamilyChoiceModal family={family} onClose={jest.fn()} onSelect={onSelect} />);

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Small' })).toBeChecked());
    fireEvent.click(screen.getByRole('radio', { name: 'Large' }));

    expect(screen.getByRole('radio', { name: 'Item only CHF 12.00' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Meal CHF 13.00' }));
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
    expect(screen.getByRole('radio', { name: 'Meal CHF 13.00' })).toBeDisabled();
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
    expect(screen.queryByRole('radio', { name: /Item only/ })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Meal CHF 13.00' })).toBeInTheDocument();
  });
});
