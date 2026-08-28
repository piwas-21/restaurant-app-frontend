import {
  attachedVariationKeys,
  isAlreadyAttached,
  nextVariationDisplayOrder,
  readVariationRows,
  toProductVariation,
} from './globalVariationLibrary';
import { LANGUAGE_CODES } from '@/config/languageConfig';
import type { GlobalVariationSummary } from '@/services/globalVariationService';

/**
 * The pure half of the variation library picker (plan S4).
 *
 * The assertions that matter are the ones that would still be TRUE if the mapping quietly copied a
 * price, minted a database id, or matched only on the provenance key — because each of those is a
 * plausible thing to do by analogy with the ingredient picker, and each is wrong here.
 */

const row = (over: Partial<GlobalVariationSummary> = {}): GlobalVariationSummary => ({
  id: 'lib-large',
  defaultName: 'Large',
  isActive: true,
  isArchived: false,
  usedOnProductCount: 3,
  translations: [
    { languageCode: 'fr', name: 'Grande' },
    { languageCode: 'de', name: 'Groß' },
  ],
  ...over,
});

describe('attachedVariationKeys / isAlreadyAttached', () => {
  it('matches a row the product already carries BY NAME, not only by provenance', () => {
    // Every variation on prod predates the library and carries no `globalVariationId` at all, so an
    // id-only key would offer a product's whole existing size ladder back as if it were new.
    const keys = attachedVariationKeys([{ name: 'Large' }]);
    expect(isAlreadyAttached(row(), keys)).toBe(true);
  });

  it('matches by provenance even when the admin has renamed the row on the product', () => {
    const keys = attachedVariationKeys([{ name: 'Family size', globalVariationId: 'lib-large' }]);
    expect(isAlreadyAttached(row(), keys)).toBe(true);
  });

  it('folds case and accents, so "grosse" is not offered again as "Grosse"', () => {
    const keys = attachedVariationKeys([{ name: '  GROSSE ' }]);
    expect(isAlreadyAttached(row({ defaultName: 'Grosse' }), keys)).toBe(true);
  });

  it('does not treat an unrelated row as attached', () => {
    const keys = attachedVariationKeys([{ name: 'Small', globalVariationId: 'lib-small' }]);
    expect(isAlreadyAttached(row(), keys)).toBe(false);
  });

  it('ignores a blank name rather than matching every unnamed row against it', () => {
    // A freshly appended blank row is the normal state of the table while an admin is typing.
    const keys = attachedVariationKeys([{ name: '   ' }]);
    expect(isAlreadyAttached(row({ defaultName: '' }), keys)).toBe(false);
  });
});

describe('toProductVariation', () => {
  it('lands at a price modifier of ZERO, because the catalog has no price to copy', () => {
    // The load-bearing assertion of this file. "Large" is +2.00 on a pizza and +0.50 on a coffee,
    // so a catalog price could only ever be wrong on one of them; 0 is neutral, and the product
    // stays sellable at its base price until the admin types the real number.
    expect(toProductVariation(row(), 0).priceModifier).toBe(0);
  });

  it('records provenance and copies the translated names it was picked for', () => {
    const variation = toProductVariation(row(), 0);
    expect(variation.globalVariationId).toBe('lib-large');
    expect(variation.name).toBe('Large');
    expect(variation.content.fr).toEqual({ name: 'Grande', description: '' });
    expect(variation.content.de).toEqual({ name: 'Groß', description: '' });
  });

  it('seeds every one of the ten locales the editor renders, not only the translated ones', () => {
    // The translations panel maps LANGUAGE_CODES; a shorter object offers fewer inputs than the
    // screen has, and the missing ones would look like fields that do not exist.
    const variation = toProductVariation(row(), 0);
    expect(Object.keys(variation.content).sort()).toEqual([...LANGUAGE_CODES].sort());
  });

  it('mints NO id — `variations[].id` means "the row the server already owns"', () => {
    // Unlike `toProductIngredient`, which issues a `temp-` id. A value here would be a claim about
    // the database; react-hook-form issues its own `field.id` for the React key.
    expect(toProductVariation(row(), 0).id).toBeUndefined();
  });

  it("continues the product's display order rather than restarting it", () => {
    expect(toProductVariation(row(), 4).displayOrder).toBe(4);
  });

  it('leaves an untranslated locale blank rather than falling back to the default name', () => {
    // A copied English word sitting in the Italian field reads as a translation somebody made.
    expect(toProductVariation(row(), 0).content.it).toEqual({ name: '', description: '' });
  });
});

describe('readVariationRows — where an appended row lands', () => {
  /**
   * THE regression this block exists for. `useVariationReorder` (#593) says in as many words that
   * live `displayOrder` data "can hold gaps and duplicates", because nothing wrote the column after
   * row creation until that slice — which is why a move re-stamps the whole array. So the row COUNT
   * is not a safe base: a product whose two rows sit at 2 and 7 would put a picked row at 2, on top
   * of one that is already there, and `displayOrder` is what every consumer sorts by.
   */
  it('starts one PAST the highest order in use, not at the row count', () => {
    const { nextDisplayOrder } = readVariationRows([
      { name: 'Small', displayOrder: 2 },
      { name: 'Large', displayOrder: 7 },
    ]);

    expect(nextDisplayOrder).toBe(8);
    // The count-based answer, stated so a future edit cannot quietly return to it.
    expect(nextDisplayOrder).not.toBe(2);
  });

  it('survives duplicates, which the same column is documented to contain', () => {
    expect(readVariationRows([{ displayOrder: 3 }, { displayOrder: 3 }]).nextDisplayOrder).toBe(4);
  });

  it('starts at 0 for a product with no variations at all', () => {
    expect(readVariationRows([]).nextDisplayOrder).toBe(0);
    expect(readVariationRows(undefined).nextDisplayOrder).toBe(0);
  });

  it('ignores a row whose order is missing rather than counting it as 0', () => {
    // A blank row appended by "Add variation" has no stored order yet; treating `undefined` as 0
    // would be harmless here but would silently cap the maximum on a NaN.
    expect(readVariationRows([{ name: 'Large', displayOrder: 5 }, { name: '' }]).nextDisplayOrder).toBe(6);
  });

  it('reads name and provenance for the already-added check, defaulting a missing name to blank', () => {
    const { attached } = readVariationRows([{ globalVariationId: 'g-1' }, { name: 'Large' }]);

    expect(attached).toEqual([
      { name: '', globalVariationId: 'g-1' },
      { name: 'Large', globalVariationId: undefined },
    ]);
  });
});

describe('nextVariationDisplayOrder — shared by BOTH add buttons', () => {
  /**
   * Exported, and tested here rather than only through the picker, because the plain "Add
   * variation" button had the SAME defect and predates this slice: it appended at
   * `variationFields.length`. Two buttons in one section disagreeing about where a new row lands is
   * worse than either being wrong alone, so they now share one rule.
   */
  it('is the same answer for a blank row as for a picked one', () => {
    const rows = [{ displayOrder: 2 }, { displayOrder: 7 }];

    expect(nextVariationDisplayOrder(rows)).toBe(8);
    expect(readVariationRows(rows).nextDisplayOrder).toBe(nextVariationDisplayOrder(rows));
  });

  it('tolerates a missing array, which is what an untouched product form holds', () => {
    expect(nextVariationDisplayOrder(undefined)).toBe(0);
  });
});
