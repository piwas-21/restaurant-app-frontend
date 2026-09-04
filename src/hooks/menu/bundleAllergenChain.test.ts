import { mapBundleDtoToMenuBundleItem, mapProductDtoToMenuItem } from '@/hooks/publicMenu/mappers';
import type { MenuBundleDto, ProductDto } from '@/hooks/publicMenu/types';
import { toBundleItemFromDetail, toCatalogItemFromBundle, toCatalogItemFromProduct } from '@/utils/catalogItem';
import { matchesFilters } from './useMenuFilters';

/**
 * Frontend #702 — a combo's allergens never reached the card or the filter.
 *
 * The filter itself was never wrong, so a test that hands `matchesFilters` a literal
 * `{ allergens: ['gluten'] }` passes today and passed before the fix. The defect lived in the two
 * PRODUCERS between the wire and the filter, and it was the same omission twice:
 * `mapBundleDtoToMenuBundleItem` did not read `allergens` off the DTO, and
 * `toCatalogItemFromBundle` did not carry it into the card view-model — where both of their
 * product siblings always have.
 *
 * So this walks the real chain, from a payload shaped like the API's to the filter's verdict.
 * Hand-built inputs anywhere in the middle would prove nothing about the thing that broke.
 *
 * Why it is a safety property: `matchesFilters` refuses an item only when its token set CONTAINS
 * the excluded token. An empty set never can, so an item with no allergens survives every "No …"
 * chip — absence reads as "free of everything", not as "unknown". A gluten combo was listed under
 * "No gluten".
 */

const GLUTEN = new Set(['without:gluten']);
const HALAL = new Set(['claim:halal']);

const bundleDto = (allergens: MenuBundleDto['allergens']): MenuBundleDto => ({
  id: 'b1',
  name: 'Menu Kebab',
  basePrice: 12,
  allergens,
});

const productDto = (allergens: string[] | null): ProductDto => ({
  id: 'p1',
  name: 'Kebab',
  basePrice: 9,
  allergens,
});

/** The chain under test: wire payload → item → card view-model. */
const bundleCard = (allergens: MenuBundleDto['allergens']) =>
  toCatalogItemFromBundle(mapBundleDtoToMenuBundleItem(bundleDto(allergens)));

const productCard = (allergens: string[] | null) =>
  toCatalogItemFromProduct(mapProductDtoToMenuItem(productDto(allergens)));

describe('a bundle’s allergens survive the whole chain', () => {
  it('excludes a labelled combo from its own "No …" chip', () => {
    // THE defect. Before the fix this returned true: the combo was shown to a guest who had
    // explicitly excluded gluten.
    expect(matchesFilters(bundleCard(['gluten', 'sesame']), GLUTEN)).toBe(false);
  });

  it('includes a labelled combo under a claim chip it satisfies', () => {
    // The other direction, and it fails the opposite way: a `claim` chip keeps only items that DO
    // carry the token, so an unmapped halal combo was HIDDEN from a guest filtering for halal.
    expect(matchesFilters(bundleCard(['halal']), HALAL)).toBe(true);
  });

  it('carries the allergens onto the card so the chips can render', () => {
    // `MenuCard` renders <AllergenDisplay allergens={item.allergens} …>, which renders nothing at
    // all for an absent array — the visible half of the same omission.
    expect(bundleCard(['gluten', 'sesame']).allergens).toEqual(['gluten', 'sesame']);
  });

  it('treats a bundle exactly as it treats a dish with the same labelling', () => {
    // The generalisation of the fix: the two mappers had drifted, and this is the assertion that
    // goes red if they drift again in either direction.
    expect(matchesFilters(bundleCard(['gluten']), GLUTEN)).toBe(matchesFilters(productCard(['gluten']), GLUTEN));
  });

  it('maps the allergens on the BY-ID producer too', () => {
    // `toBundleItemFromDetail` is the second producer of a MenuBundleItem — the featured combo's
    // "Details", and the `findBundle` miss. It omitted the field as well, so the same row reached
    // the sheet labelled through one path and unlabelled through the other.
    const item = toBundleItemFromDetail({
      id: 'b1',
      name: 'Menu Kebab',
      // `type: 'menu'` and a menuDefinition are the producer's own preconditions — it returns null
      // for a plain product, so omitting either makes this pass vacuously against a null it never
      // dereferences.
      type: 'menu',
      basePrice: 12,
      allergens: ['gluten'],
      content: {},
      images: [],
      menuDefinition: { sections: [] },
    } as never);

    expect(item).not.toBeNull();
    expect(item?.allergens).toEqual(['gluten']);
  });

  describe('controls', () => {
    it.each([
      ['null — the only shape the backend actually produces for an unlabelled bundle', null],
      ['absent — a backend older than #477', undefined],
    ])('leaves an unlabelled combo visible (%s)', (_why, allergens) => {
      // Permissive-on-missing-data, unchanged and deliberately so. Making absence mean "might
      // contain anything" would withhold every unlabelled item on every menu on the platform —
      // a far larger decision than this fix, and the reason the LABELLING has to be complete.
      expect(matchesFilters(bundleCard(allergens as MenuBundleDto['allergens']), GLUTEN)).toBe(true);
    });

    it('still shows a labelled combo under a chip it does not match', () => {
      // Discrimination: the exclusion above must come from the token, not from the fix rejecting
      // every labelled bundle outright.
      expect(matchesFilters(bundleCard(['gluten']), new Set(['without:nuts']))).toBe(true);
    });

    it('normalises a malformed payload to an empty list rather than throwing', () => {
      // The mapper guards with Array.isArray, matching its product sibling. A string here used to
      // be impossible to reach; it is reachable the moment anything hand-writes this payload.
      expect(bundleCard('gluten' as unknown as string[]).allergens).toEqual([]);
    });
  });
});
