import React from 'react';
import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import type { FieldValues } from 'react-hook-form';
import ProductAdvancedFields from './ProductAdvancedFields';
import { createProductSchema } from '../schemas';
import { itemProductTypes, productTypes } from '../types';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/**
 * Slice **S8** (D7) — the two dead controls in the Advanced section.
 */
function Host({ hasVariations, isComponent = false }: Readonly<{ hasVariations: boolean; isComponent?: boolean }>) {
  const { register } = useForm<FieldValues>({
    defaultValues: { type: 'mainItem', hideBaseProduct: true, isComponent },
  });
  return <ProductAdvancedFields register={register} hasVariations={hasVariations} />;
}

describe('ProductAdvancedFields — the type select', () => {
  it('does not offer `menu`, because picking it produced a bundle with no bundle', () => {
    render(<Host hasVariations />);

    const options = Array.from(screen.getByRole('combobox').querySelectorAll('option')).map((o) => o.value);
    expect(options).not.toContain('menu');
    expect(options).toEqual([...itemProductTypes]);
  });

  it('but the SCHEMA still accepts `menu` — the vocabulary and the offer are different lists', () => {
    // The load-bearing half of the change. A zod enum narrowed alongside the select would turn an
    // existing `menu`-typed row into a save the admin cannot complete and cannot explain, since no
    // control in the editor could move the value back into range.
    expect(productTypes).toContain('menu');
    expect(createProductSchema.shape.type.safeParse('menu').success).toBe(true);
  });
});

describe('ProductAdvancedFields — hideBaseProduct', () => {
  it('is hidden when the item has no variation to redirect an order to', () => {
    render(<Host hasVariations={false} />);

    const checkbox = screen.getByLabelText('hide_base_product');
    // Present and registered — see the next test for why that matters — but not offered.
    expect(checkbox.closest('[hidden]')).not.toBeNull();
  });

  it('appears as soon as there is a variation', () => {
    render(<Host hasVariations />);

    expect(screen.getByLabelText('hide_base_product').closest('[hidden]')).toBeNull();
  });

  it('stays MOUNTED while hidden, so the next save cannot clear the column', () => {
    render(<Host hasVariations={false} />);

    // Plan §6: an unmounted registered field is a value the PUT rewrites. A product whose
    // variations were removed must keep `hideBaseProduct` as it was — the variations may come back.
    const checkbox = screen.getByLabelText('hide_base_product') as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.checked).toBe(true);
  });
});

/**
 * The OPTION-ONLY flag (frontend #631) — the box that keeps one of a bundle's six meats off the
 * guest menu.
 *
 * Its two properties are the opposite of `hideBaseProduct`'s above, which is why they are worth
 * pinning separately: it is ALWAYS offered (there is no precondition to wait for, and it is the
 * only control that can turn itself back off), and it carries a sentence, because the consequence
 * — the item disappears from the menu — cannot be read off the label.
 */
describe('ProductAdvancedFields — the option-only flag', () => {
  it('is offered even for an item with no variation, unlike hideBaseProduct', () => {
    render(<Host hasVariations={false} />);

    expect(screen.getByLabelText('option_only_item').closest('[hidden]')).toBeNull();
  });

  it('says what ticking it does, as the checkbox’s own description', () => {
    render(<Host hasVariations />);

    // The ACCESSIBLE description, not a `<p>` that merely sits nearby: a sentence with no
    // programmatic link to the control exists on screen and nowhere in the accessibility tree.
    expect(screen.getByLabelText('option_only_item')).toHaveAccessibleDescription('option_only_item_help');
  });

  it('shows a stored option-only item as ticked', () => {
    render(<Host hasVariations={false} isComponent />);

    expect(screen.getByLabelText('option_only_item')).toBeChecked();
  });

  it('is unticked for an ordinary item', () => {
    render(<Host hasVariations={false} />);

    expect(screen.getByLabelText('option_only_item')).not.toBeChecked();
  });
});
