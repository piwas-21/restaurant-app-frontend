import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { FieldErrors, FieldValues } from 'react-hook-form';
import { ProductVariations } from './ProductVariations';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

// The picker is exercised in `GlobalVariationPickerModal.test.tsx`; here it would only pull a
// network mock into a test about where a BLANK row lands.
jest.mock('./VariationLibraryButton', () => ({
  __esModule: true,
  default: () => null,
}));

const appendVariation = jest.fn();

/**
 * A product whose `displayOrder` column has a GAP — which `useVariationReorder` (#593) documents as
 * a normal state of live data, because nothing wrote the column after row creation until that
 * slice. Two rows, orders 2 and 7, so the row COUNT (2) names an order that is already taken.
 */
const ROWS = [
  { id: 'rhf-1', name: 'Small', displayOrder: 2 },
  { id: 'rhf-2', name: 'Large', displayOrder: 7 },
];

const renderTable = (errors: FieldErrors<FieldValues> = {}) =>
  render(
    <ProductVariations
      register={() => ({})}
      errors={errors}
      variationFields={ROWS}
      appendVariation={appendVariation}
      removeVariation={jest.fn()}
      moveVariation={jest.fn()}
      getValues={(() => ROWS) as never}
    />,
  );

beforeEach(() => jest.clearAllMocks());

describe('Add variation — where a blank row lands', () => {
  /**
   * This button appended at `variationFields.length` until the variation-library slice, which is
   * the same defect the picker had: on THIS product that is 2, and a row already sits at 2.
   * `displayOrder` is what every consumer sorts by, so the new row would have collided with an
   * existing one rather than landing at the end where the admin asked for it.
   */
  it('lands one PAST the highest order in use, not at the row count', () => {
    renderTable();

    fireEvent.click(screen.getByRole('button', { name: /add_variation/ }));

    expect(appendVariation).toHaveBeenCalledTimes(1);
    expect(appendVariation.mock.calls[0][0]).toMatchObject({ displayOrder: 8 });
    // Stated against by value so a future edit cannot quietly return to the count.
    expect(appendVariation.mock.calls[0][0].displayOrder).not.toBe(ROWS.length);
  });

  it('appends an otherwise empty, active row', () => {
    renderTable();

    fireEvent.click(screen.getByRole('button', { name: /add_variation/ }));

    expect(appendVariation.mock.calls[0][0]).toMatchObject({
      name: '',
      description: '',
      priceModifier: 0,
      isActive: true,
      content: {},
    });
  });
});

/**
 * Every cell in this table says what is wrong with it — the rule the editor's phantom
 * `Fields to fix: 1` broke (owner report 2026-08-28).
 *
 * The description cell used to render no message at ALL. That is what turned a wrong schema into an
 * unexplainable one: a variation loaded with `description: null` failed the resolver, the save was
 * refused before any request was built, and the page showed nothing anywhere. The schema now
 * accepts the null (`optionalText` in `schemas.ts`), so this is the second lock — a message must
 * appear on whichever cell fails, whatever makes it fail next.
 */
describe('Variation cells — no field fails silently', () => {
  it.each([
    ['name', 'Variation name is required'],
    ['description', 'Something refused this description'],
    ['priceModifier', 'Expected number'],
  ])('renders the message for a failing %s', (field, message) => {
    renderTable({ variations: [{ [field]: { type: 'custom', message } }] } as unknown as FieldErrors<FieldValues>);

    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
