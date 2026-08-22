import { isBaseRowHidden, startingPrice, firstActiveVariationId } from './baseProductVisibility';

/**
 * The client mirror of the server's `BaseProductVisibility` (backend #399, Track F / F2). The
 * DEGRADE is the part worth pinning: nothing else in the app fails loudly if it stops applying —
 * the sheet would simply render no orderable option and the guest would meet a 400 they cannot act
 * on, which is the state this rule exists to prevent.
 */
describe('isBaseRowHidden', () => {
  it('is false for every product that did not ask to hide its base — i.e. the whole catalogue', () => {
    expect(isBaseRowHidden(false, [{ isActive: true }])).toBe(false);
    expect(isBaseRowHidden(undefined, [{ isActive: true }])).toBe(false);
  });

  it('is true when the flag is set and a variation is active', () => {
    expect(isBaseRowHidden(true, [{ isActive: false }, { isActive: true }])).toBe(true);
  });

  it('degrades to false when every variation is inactive, so the product stays orderable', () => {
    expect(isBaseRowHidden(true, [{ isActive: false }])).toBe(false);
  });

  it('degrades to false when the product has no variations at all', () => {
    expect(isBaseRowHidden(true, [])).toBe(false);
    expect(isBaseRowHidden(true, undefined)).toBe(false);
  });

  it('treats an absent isActive as active, matching every list that ships only active rows', () => {
    // `ProductSummaryDto.Variations` is already filtered to active ones server-side, so a missing
    // flag there means "active" — reading it as inactive would silently un-hide the base row on
    // the browse card while the sheet hid it.
    expect(isBaseRowHidden(true, [{ priceModifier: 0 }])).toBe(true);
  });
});

describe('startingPrice', () => {
  it('is the base plus the SMALLEST active modifier', () => {
    expect(
      startingPrice(6, [
        { isActive: true, priceModifier: 2 },
        { isActive: true, priceModifier: 0.5 },
      ]),
    ).toBe(6.5);
  });

  it('ignores inactive variations — their price is not one a guest can pay', () => {
    expect(
      startingPrice(6, [
        { isActive: false, priceModifier: -3 },
        { isActive: true, priceModifier: 1 },
      ]),
    ).toBe(7);
  });

  it('handles a negative modifier, which is a real discount and not a data error', () => {
    expect(startingPrice(10, [{ isActive: true, priceModifier: -2 }])).toBe(8);
  });

  it('ignores a garbled modifier rather than pricing the card at NaN', () => {
    // Wire-defensive, in line with `parseBasePrice` in the public-menu mapper: a card that printed
    // "CHF NaN" would be worse than one that printed the base price.
    expect(startingPrice(6, [{ isActive: true, priceModifier: Number.NaN }])).toBe(6);
    expect(startingPrice(6, [{ isActive: true }])).toBe(6);
  });

  it('falls back to the base price when there is no active variation', () => {
    expect(startingPrice(6, [{ isActive: false, priceModifier: 1 }])).toBe(6);
    expect(startingPrice(6, undefined)).toBe(6);
  });
});

describe('firstActiveVariationId', () => {
  it('is the first ACTIVE variation in DISPLAY order, not simply the first one', () => {
    // The latent bug this replaces: `variations[0]` opened the sheet on a selection whose radio
    // `VariationsSection` does not render, because it lists active ones only.
    const variations = [
      { id: 'off', isActive: false, displayOrder: 0 },
      { id: 'second', isActive: true, displayOrder: 2 },
      { id: 'first', isActive: true, displayOrder: 1 },
    ];

    expect(firstActiveVariationId(variations)).toBe('first');
  });

  it('keeps wire order when no display order is given', () => {
    expect(
      firstActiveVariationId([
        { id: 'a', isActive: true },
        { id: 'b', isActive: true },
      ]),
    ).toBe('a');
  });

  it('is null when nothing is selectable, which is the base row', () => {
    expect(firstActiveVariationId([{ id: 'off', isActive: false }])).toBeNull();
    expect(firstActiveVariationId([])).toBeNull();
    expect(firstActiveVariationId(undefined)).toBeNull();
  });

  it('skips a variation with no id — it cannot be posted as a selection', () => {
    expect(
      firstActiveVariationId([
        { isActive: true, displayOrder: 0 },
        { id: 'v2', isActive: true, displayOrder: 1 },
      ]),
    ).toBe('v2');
  });
});
