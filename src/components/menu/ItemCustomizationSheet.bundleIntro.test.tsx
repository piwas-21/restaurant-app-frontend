import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import ItemCustomizationSheet from './ItemCustomizationSheet';
import { useBundleCustomizationSheet } from '@/hooks/menu/useBundleCustomizationSheet';
import type { MenuBundleItem } from '@/types/menu';

/**
 * The sheet's intro panel for a COMBO (#702 follow-through).
 *
 * `ItemCustomizationSheet` narrowed `detail` to the product branch and fed `SheetIntro` from it, so
 * the bundle branch — where `detail` is always null — showed no allergens and no preparation time,
 * whatever the combo carried.
 *
 * That was invisible while nothing served a bundle's allergens. It stops being invisible in the
 * same change that fixes the card: the guest now sees allergen icons on the combo, taps in to read
 * what they mean, and gets a blank panel. A card that says nothing is better than a card that
 * promises detail the sheet withholds.
 *
 * Driven through the REAL controller (`useBundleCustomizationSheet.openForBundle`) rather than a
 * hand-built one — the sheet reads `controller.bundle`, so a hand-made controller would only prove
 * that a fixture agrees with the assertion written beside it.
 */

jest.mock('@/components/cart/CartContext', () => ({ useCart: () => ({ addItem: jest.fn() }) }));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: jest.fn() }) }));
// `t` must honour i18next's DEFAULT-VALUE argument. `AllergenDisplay` renders
// `t('allergen_gluten', 'gluten')`, so a mock that returns the key alone makes the chip read
// `allergen_gluten` and every assertion here fail for a reason that has nothing to do with the
// component — the mock would be stable in the wrong axis.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));
jest.mock('@/hooks/menu/useItemAvailabilityNotice', () => ({
  useItemAvailabilityNotice: jest.fn(() => null),
}));

const BUNDLE = {
  id: 'b1',
  name: 'Menu Kebab',
  description: 'Kebab, frites, boisson',
  basePrice: 12,
  content: {},
  isActive: true,
  isAvailable: true,
  isSpecial: false,
  displayOrder: 0,
  preparationTimeMinutes: 15,
  allergens: ['gluten', 'sesame'],
  menuDefinition: {
    isAlwaysAvailable: true,
    sections: [
      {
        id: 's1',
        name: 'Boisson',
        displayOrder: 1,
        isRequired: true,
        minSelection: 1,
        maxSelection: 1,
        items: [
          { id: 'i1', productId: 'p1', productName: 'Cola', additionalPrice: 0, displayOrder: 1, isDefault: true },
        ],
      },
    ],
  },
} as unknown as MenuBundleItem;

function Harness({ bundle }: Readonly<{ bundle: MenuBundleItem }>) {
  const controller = useBundleCustomizationSheet({ onAdded: jest.fn(), onLineAdded: jest.fn() });
  return (
    <>
      <button type="button" onClick={() => controller.openForBundle(bundle)}>
        open
      </button>
      <ItemCustomizationSheet controller={controller} />
    </>
  );
}

const open = async (bundle: MenuBundleItem) => {
  render(<Harness bundle={bundle} />);
  await act(async () => {
    screen.getByRole('button', { name: 'open' }).click();
  });
};

describe('the customization sheet’s intro for a combo', () => {
  it('shows the bundle’s own allergens', async () => {
    await open(BUNDLE);

    expect(screen.getByText('gluten')).toBeInTheDocument();
    expect(screen.getByText('sesame')).toBeInTheDocument();
  });

  it('shows the bundle’s own preparation time', async () => {
    // The identical hole, one line below the allergens — `detail?.preparationTimeMinutes` on a
    // branch where `detail` is null.
    await open(BUNDLE);

    expect(screen.getByText(/15/)).toBeInTheDocument();
  });

  it('renders no allergen chips for an unlabelled combo', async () => {
    // The control. Without it, a change that hardcoded chips would satisfy both assertions above.
    await open({ ...BUNDLE, allergens: undefined } as MenuBundleItem);

    expect(screen.queryByText('gluten')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'allergens' })).not.toBeInTheDocument();
  });
});
