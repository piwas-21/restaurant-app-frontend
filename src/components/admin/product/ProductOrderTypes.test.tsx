import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ProductOrderTypes from './ProductOrderTypes';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
      const values = (typeof fallback === 'string' ? options : fallback) as Record<string, unknown> | undefined;
      const text = typeof fallback === 'string' ? fallback : key;
      if (!values) return text;
      return Object.entries(values).reduce((acc, [name, value]) => acc.replaceAll(`{{${name}}}`, String(value)), text);
    },
  }),
}));

const DURUM = { id: 'c1', name: 'Dürüm Wraps', availableOrderTypes: 6 };
const GRILLS = { id: 'c2', name: 'Grills', availableOrderTypes: null };

const renderControl = (props: Partial<React.ComponentProps<typeof ProductOrderTypes>> = {}) => {
  const onChange = jest.fn();
  render(
    <ProductOrderTypes
      value={null}
      onChange={onChange}
      categories={[DURUM, GRILLS]}
      primaryCategoryId="c1"
      {...props}
    />,
  );
  return { onChange };
};

const box = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
/** D6's switch. `getByRole('switch')` and not a label lookup — the role IS the contract. */
const overrideSwitch = () => screen.getByRole('switch') as HTMLInputElement;

describe('ProductOrderTypes', () => {
  it('names the primary category and the channels an inheriting item would get', () => {
    renderControl();

    expect(screen.getByText('Inherit from category (Dürüm Wraps: Takeaway, Delivery)')).toBeInTheDocument();
  });

  it('previews the inherited set on disabled boxes so turning the override on starts from it', () => {
    renderControl();

    expect(box('Takeaway').checked).toBe(true);
    expect(box('Delivery').checked).toBe(true);
    expect(box('Dine In').checked).toBe(false);
    expect(box('Dine In').disabled).toBe(true);
  });

  it('seeds the override with the inherited mask rather than an empty selection', () => {
    const { onChange } = renderControl();

    fireEvent.click(overrideSwitch());

    // 6 = takeaway|delivery, the set that was already in force.
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('sends an explicit all-three override as 7, NOT as null', () => {
    // The trap: `maskFromOrderTypes` collapses a full set to null, which on a product means
    // "inherit" — silently handing the item back to its takeaway-only category.
    const { onChange } = renderControl({ value: 6 });

    fireEvent.click(box('Dine In'));

    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('switching the override off clears the mask', () => {
    const { onChange } = renderControl({ value: 2 });

    fireEvent.click(overrideSwitch());

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('warns when there is no primary category to inherit from', () => {
    renderControl({ primaryCategoryId: '' });

    expect(screen.getByText(/No primary category selected/)).toBeInTheDocument();
    // Nothing to inherit ⇒ permissive, matching the server's fallback.
    expect(box('Dine In').checked).toBe(true);
  });

  // §9.2. The bundle notice is NOT gated on the category list having loaded, and that is the whole
  // point: `useProductEditorForm` never fetches categories for a bundle, so a `categoriesLoaded`
  // guard would mean "never" rather than "wait and see" — the combo admin would face an Inherit
  // option pointing at nothing, with no explanation.
  it('always explains the empty Inherit option on a bundle, even with no categories loaded', () => {
    renderControl({ isBundle: true, categories: [], primaryCategoryId: '' });

    expect(screen.getByText(/This editor cannot give a combo a category/)).toBeInTheDocument();
    expect(screen.queryByText(/No primary category selected/)).not.toBeInTheDocument();
  });

  it('keeps the item wording for an item', () => {
    renderControl({ primaryCategoryId: '' });

    expect(screen.queryByText(/This editor cannot give a combo a category/)).not.toBeInTheDocument();
  });

  it('renders the validation error for an empty custom selection', () => {
    const { onChange } = renderControl({ value: 1, error: 'Choose at least one order type' });

    fireEvent.click(box('Dine In'));

    expect(onChange).toHaveBeenCalledWith(0);
    expect(screen.getByText('Choose at least one order type')).toBeInTheDocument();
  });
});

/**
 * S5 / D6 — THE ROUND-TRIP, and it is the reason this slice exists.
 *
 * `null` and `7` are the two states that look IDENTICAL in a UI drawing three ticked boxes, and
 * they are opposites in the data: `null` on a product means INHERIT, `7` means "explicitly all
 * three, whatever the category becomes". A control that writes `null` where the admin meant `7`
 * fails silently — nothing errors, the boxes look right, and the item quietly re-inherits the next
 * time someone edits its category. (The other direction fails LOUDLY and is already covered: mask
 * `0` is rejected by the API — `OrderChannelMaskRule` accepts `null` or 1..7 — and refused
 * client-side by `isStorableMask` plus the editor's `canSave` gate.)
 *
 * Each case is a real round trip: drive the control, take the value it EMITS, render a fresh
 * control with it, and assert what the admin then sees. Asserting the emitted number alone would
 * pass for a control that writes correctly and displays wrongly.
 */
describe('ProductOrderTypes — D6 round-trip', () => {
  /** Feed a control's own output back in, the way the form and a reload do. */
  const roundTrip = (emitted: number | null, props: Partial<React.ComponentProps<typeof ProductOrderTypes>> = {}) => {
    cleanup();
    return renderControl({ value: emitted, ...props });
  };

  it('turning the override on over an ALL-THREE category emits 7, not null', () => {
    // GRILLS has `availableOrderTypes: null` — unrestricted, so the inherited set is all three.
    // This is the exact shape where `maskFromOrderTypes` collapses to null and destroys the
    // override; `exactMaskFromOrderTypes` is what keeps it.
    const { onChange } = renderControl({ primaryCategoryId: 'c2' });

    expect(box('Dine In').checked).toBe(true);
    expect(box('Takeaway').checked).toBe(true);
    expect(box('Delivery').checked).toBe(true);

    fireEvent.click(overrideSwitch());

    expect(onChange).toHaveBeenCalledWith(7);
    expect(onChange).not.toHaveBeenCalledWith(null);
  });

  it('a 7 read back is an OVERRIDE, not inheritance — the switch is on', () => {
    roundTrip(7, { primaryCategoryId: 'c2' });

    // The whole point: 7 and null paint the same three ticks. Only the switch tells them apart.
    expect(overrideSwitch().checked).toBe(true);
    expect(box('Dine In').disabled).toBe(false);
  });

  it('a null read back is INHERITANCE — the switch is off and the boxes are locked', () => {
    roundTrip(null, { primaryCategoryId: 'c2' });

    expect(overrideSwitch().checked).toBe(false);
    expect(box('Dine In').disabled).toBe(true);
  });

  it('a genuine SUBSET survives the round trip unchanged', () => {
    // 3 = dine-in|takeaway against a takeaway|delivery category, so it agrees with neither the
    // inherited set nor the full set. THE CONTROL for this whole describe: every assertion above
    // is also satisfied by a control that writes nothing and shows nothing, and this one is not.
    const { onChange } = roundTrip(3);

    expect(overrideSwitch().checked).toBe(true);
    expect(box('Dine In').checked).toBe(true);
    expect(box('Takeaway').checked).toBe(true);
    expect(box('Delivery').checked).toBe(false);
    // Reading it back must not rewrite it — a control that "corrects" its own value on mount would
    // make the mask drift on every visit to the page.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clearing the override returns the field to inheritance, not to the last value it held', () => {
    // D6 in one assertion. The item is dine-in-only (1) while its category is takeaway|delivery.
    const { onChange } = renderControl({ value: 1 });
    expect(box('Dine In').checked).toBe(true);

    fireEvent.click(overrideSwitch());
    expect(onChange).toHaveBeenCalledWith(null);

    // What the admin then SEES: the category's set, not the frozen dine-in it just left.
    roundTrip(onChange.mock.calls[0][0] as number | null);
    expect(box('Dine In').checked).toBe(false);
    expect(box('Takeaway').checked).toBe(true);
    expect(box('Delivery').checked).toBe(true);
  });

  it('the switch is derived from the value, so it cannot drift from the field it edits', () => {
    roundTrip(2);
    expect(overrideSwitch().checked).toBe(true);

    roundTrip(null);
    expect(overrideSwitch().checked).toBe(false);
  });
});
