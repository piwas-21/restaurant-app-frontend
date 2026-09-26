import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import type { FieldValues } from 'react-hook-form';
import ProductAdvancedFields from './ProductAdvancedFields';
import { getProductParentBundles } from '@/services/productParentBundlesService';
import type { Variation } from '@/app/admin/menu-management/interfaces';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/services/productParentBundlesService', () => ({ getProductParentBundles: jest.fn() }));

const variations: Variation[] = [
  { id: 'variation-1', name: 'Large', priceModifier: 1, finalPrice: 11, isActive: true },
];

/**
 * Advanced holds the internal-item switch and, for saved components, their read-only parent menus.
 *
 * The type select moved to Basics (it decides how the guest sheet groups this item in an upsell
 * step, which is not a once-a-lifetime setting) and `hideBaseProduct` became the ACTIVE switch on
 * the variations table's own base row. Their tests moved with them — `ProductBasicsFields.test` and
 * `ProductVariations.test` respectively — rather than being deleted with the props.
 */
function Host({
  isComponent = false,
  productId,
  onNavigate,
}: Readonly<{ isComponent?: boolean; productId?: string; onNavigate?: (href: string) => void }> = {}) {
  const { register, control } = useForm<FieldValues>({ defaultValues: { isComponent } });
  return (
    <ProductAdvancedFields
      register={register}
      control={control}
      productId={productId}
      variations={variations}
      onNavigate={onNavigate}
    />
  );
}

/**
 * The OPTION-ONLY flag (frontend #631) — the box that keeps one of a bundle's six meats off the
 * guest menu.
 *
 * It is ALWAYS offered — there is no precondition to wait for, and it is the only control that can
 * turn itself back off — and it carries a sentence, because the consequence (the item disappears
 * from the menu) cannot be read off the label.
 */
describe('ProductAdvancedFields — the option-only flag', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is offered for every item, with no precondition to wait for', () => {
    render(<Host />);

    expect(screen.getByLabelText('option_only_item').closest('[hidden]')).toBeNull();
  });

  it('says what ticking it does, as the checkbox’s own description', () => {
    render(<Host />);

    // The ACCESSIBLE description, not a `<p>` that merely sits nearby: a sentence with no
    // programmatic link to the control exists on screen and nowhere in the accessibility tree.
    expect(screen.getByLabelText('option_only_item')).toHaveAccessibleDescription('option_only_item_help');
  });

  it('shows a stored option-only item as ticked', () => {
    render(<Host isComponent />);

    expect(screen.getByLabelText('option_only_item')).toBeChecked();
  });

  it('is unticked for an ordinary item', () => {
    render(<Host />);

    expect(screen.getByLabelText('option_only_item')).not.toBeChecked();
  });

  it('loads parent menus with active state and exact base/variation references', async () => {
    (getProductParentBundles as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: {
        items: [
          {
            id: 'menu-1',
            name: 'Family Meal',
            isActive: true,
            references: [
              { sectionId: 'section-base', productVariationId: null },
              { sectionId: 'section-large', productVariationId: 'variation-1' },
            ],
          },
          { id: 'menu-2', name: 'Lunch Meal', isActive: false, references: [] },
        ],
      },
    });
    const onNavigate = jest.fn();

    render(<Host isComponent productId="component-1" onNavigate={onNavigate} />);

    const family = await screen.findByRole('link', { name: 'Family Meal' });
    expect(family).toHaveAttribute('href', '/admin/menu-management/menu-1');
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('inactive')).toBeInTheDocument();
    expect(screen.getByText('base_product_reference')).toBeInTheDocument();
    expect(screen.getByText('variation: Large')).toBeInTheDocument();
    fireEvent.click(family);
    expect(onNavigate).toHaveBeenCalledWith('/admin/menu-management/menu-1');
    expect(getProductParentBundles).toHaveBeenCalledWith('component-1', expect.any(AbortSignal));
  });

  it('does not request parent menus for ordinary items', () => {
    render(<Host productId="sellable-1" />);

    expect(getProductParentBundles).not.toHaveBeenCalled();
    expect(screen.queryByText('parent_menu_bundles')).not.toBeInTheDocument();
  });
});
