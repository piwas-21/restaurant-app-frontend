import React from 'react';
import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import type { FieldValues } from 'react-hook-form';
import ProductAdvancedFields from './ProductAdvancedFields';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/**
 * Advanced holds ONE control now.
 *
 * The type select moved to Basics (it decides how the guest sheet groups this item in an upsell
 * step, which is not a once-a-lifetime setting) and `hideBaseProduct` became the ACTIVE switch on
 * the variations table's own base row. Their tests moved with them — `ProductBasicsFields.test` and
 * `ProductVariations.test` respectively — rather than being deleted with the props.
 */
function Host({ isComponent = false }: Readonly<{ isComponent?: boolean }> = {}) {
  const { register } = useForm<FieldValues>({ defaultValues: { isComponent } });
  return <ProductAdvancedFields register={register} />;
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
});
