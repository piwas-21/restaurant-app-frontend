import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
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

/**
 * A REAL `useForm`, not a stubbed `register`. The base row's Active switch is a `Controller` over
 * `hideBaseProduct`, so a fake control could only prove that the JSX exists — not that the switch
 * reads and writes the field, which is the whole of what moved here from Advanced.
 */
const renderTable = (
  errors: FieldErrors<FieldValues> = {},
  { rows = ROWS, hideBaseProduct = false }: { rows?: typeof ROWS; hideBaseProduct?: boolean } = {},
) => {
  const seen: { hideBaseProduct?: boolean } = {};
  function Wrapper() {
    // `name` and `basePrice` are in the defaults because the base row WATCHES them rather than
    // taking them as props — they are edited on this page, so a fetched value would print a stale
    // number under the input that changed it. The next test drives that live.
    const { register, control, watch } = useForm<FieldValues>({
      defaultValues: { hideBaseProduct, name: 'Margherita Pizza', basePrice: 12 },
    });
    seen.hideBaseProduct = watch('hideBaseProduct') as boolean;
    return (
      <ProductVariations
        register={register}
        errors={errors}
        variationFields={rows}
        appendVariation={appendVariation}
        removeVariation={jest.fn()}
        moveVariation={jest.fn()}
        getValues={(() => rows) as never}
        control={control}
      />
    );
  }
  return { ...render(<Wrapper />), seen };
};

beforeEach(() => jest.clearAllMocks());

describe('narrow-screen table labels', () => {
  it('puts a translated label on every mobile card field', () => {
    const { container } = renderTable();
    // `nth-child(2)`: the first row is the item's own base row, which is not an editable variation
    // and carries no actions cell — see the base-row describe below.
    const firstRow = container.querySelector('tbody tr:nth-child(2)');

    expect(
      Array.from(firstRow?.querySelectorAll('td[data-label]') ?? [], (cell) => cell.getAttribute('data-label')),
    ).toEqual(['reorder', 'variation_name', 'variation_description', 'price_modifier', 'active', 'actions']);
  });
});

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
/**
 * The item's own row, first in its own variations table.
 *
 * A guest choosing a size sees the dish's own name at the top of the list and the sizes under it —
 * `VariationsSection` renders exactly that. The admin saw only the sizes, and the switch that
 * withholds the base row lived under a collapsed **Advanced**, five sections away, labelled with
 * the negative of what they were looking at.
 */
describe('the base row', () => {
  it('lists the item itself, first, with its own name and price', () => {
    renderTable();

    const rows = screen.getAllByRole('row');
    // [0] is the header; [1] must be the item, before Small and Large.
    expect(rows[1]).toHaveTextContent('Margherita Pizza');
    expect(rows[1]).toHaveTextContent('variation_base_item');
    expect(rows[1]).toHaveTextContent('12.00');
  });

  it('shows an orderable base row as ACTIVE — the switch is the inverse of the stored flag', () => {
    renderTable({}, { hideBaseProduct: false });

    expect(screen.getByLabelText('variation_base_item_active')).toBeChecked();
  });

  it('shows a withheld base row as inactive', () => {
    renderTable({}, { hideBaseProduct: true });

    expect(screen.getByLabelText('variation_base_item_active')).not.toBeChecked();
  });

  it('writes the INVERSE back: switching it off withholds the base row', () => {
    const { seen } = renderTable({}, { hideBaseProduct: false });

    fireEvent.click(screen.getByLabelText('variation_base_item_active'));

    expect(seen.hideBaseProduct).toBe(true);
  });

  it('offers no way to remove or reorder the item from its own list', () => {
    renderTable();

    const baseRow = screen.getAllByRole('row')[1];
    expect(baseRow.querySelectorAll('button')).toHaveLength(0);
  });

  /**
   * Plan §6: a registered field the form stops rendering is a value the PUT clears. An item that
   * withholds its base row and then loses its variations must not have that column silently
   * rewritten — its variations may come back.
   */
  it('keeps hideBaseProduct registered when there is no table to draw it in', () => {
    const { container } = render(
      (() => {
        function Wrapper() {
          const { register, control } = useForm<FieldValues>({
            defaultValues: { hideBaseProduct: true, name: 'Margherita Pizza', basePrice: 12 },
          });
          return (
            <ProductVariations
              register={register}
              errors={{}}
              variationFields={[]}
              appendVariation={appendVariation}
              removeVariation={jest.fn()}
              moveVariation={jest.fn()}
              getValues={(() => []) as never}
              control={control}
            />
          );
        }
        return <Wrapper />;
      })(),
    );

    const field = container.querySelector('input[name="hideBaseProduct"]') as HTMLInputElement;
    expect(field).toBeInTheDocument();
    expect(field.checked).toBe(true);
  });

  /**
   * The failure the first version shipped and a browser found: the row read the FETCHED product, so
   * typing a new base price into the input rendered immediately ABOVE this table left the row
   * beneath it showing the old number, in the same viewport. Measured then; pinned now.
   */
  it('follows the FORM as the name and price are edited, not the fetched product', () => {
    function Wrapper() {
      const { register, control, setValue } = useForm<FieldValues>({
        defaultValues: { hideBaseProduct: false, name: 'Margherita Pizza', basePrice: 12 },
      });
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setValue('name', 'Marinara');
              setValue('basePrice', 25);
            }}
          >
            edit
          </button>
          <ProductVariations
            register={register}
            errors={{}}
            variationFields={ROWS}
            appendVariation={appendVariation}
            removeVariation={jest.fn()}
            moveVariation={jest.fn()}
            getValues={(() => ROWS) as never}
            control={control}
          />
        </>
      );
    }
    render(<Wrapper />);

    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Margherita Pizza');

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));

    const baseRow = screen.getAllByRole('row')[1];
    expect(baseRow).toHaveTextContent('Marinara');
    expect(baseRow).toHaveTextContent('25.00');
    expect(baseRow).not.toHaveTextContent('12.00');
  });
});
