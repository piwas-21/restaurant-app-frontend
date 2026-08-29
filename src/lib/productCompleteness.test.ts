import {
  COMPLETENESS_RULES,
  SCORED_COMPLETENESS_FIELDS,
  getProductCompleteness,
  getSummaryRowCompleteness,
} from './productCompleteness';

/**
 * The completeness rules (MENU-ITEM-EDITOR-REDESIGN-PLAN, S10).
 *
 * Two surfaces read this module — the editor's side-rail meter and the menu list's row chips — so a
 * defect here is a defect the admin sees in two places that agree with each other and are both
 * wrong. Every case below is stated as an EXPECTED VALUE written by hand, never as a re-computation
 * of the implementation.
 */
/**
 * MEASURED MUTATION SIGNATURES (S10). Eleven mutants applied to the tree, the suite re-run, each
 * one red. Recorded by TEST NAME rather than by count, because counts decay as the suite grows.
 *
 * | Mutant | Killed by |
 * |---|---|
 * | `photoCount > 0` → `>= 0` | 11 tests across all three files — the rule every surface reads |
 * | the description rule drops `.trim()` | *treats a whitespace-only description as not written* |
 * | the list row falls back to `imageUrl` | *ignores `imageUrl`, which this endpoint never populates* + *keeps "needs photo" on a row that has an imageUrl but no images* |
 * | the allergen note is deleted | *renders whenever the meter does* + *is explanatory copy, not an alert and not a live region* |
 * | the note gains `role="status"` | *is explanatory copy, not an alert and not a live region* |
 * | the glyph loses `aria-hidden` | *hides the tick and the ring from the accessibility tree* |
 * | a bundle gets chips | *gives a BUNDLE no chips, because it has no gallery to fix them with* |
 * | the chip list renders when empty | *drops a chip as soon as the field is filled* |
 * | the create route gets a meter (`!isBundle`) | *gives the CREATE route none, because nothing has been typed yet* |
 * | a bundle gets a meter (`!isCreate` / `true`) | *gives a BUNDLE none, because it has no gallery to manage* |
 * | the meter reads `product.description` instead of watching the form | *follows the form, not the loaded product* |
 *
 * The ninth SURVIVED on the first run and is the reason four tests exist in
 * `ProductEditorPage.test.tsx`: the rail draws whatever score it is handed, so "who gets a meter at
 * all" is a decision of the PAGE, and nothing rendered the page in create mode and looked at its
 * rail. The mutant landed (anchored applied-check, one occurrence) and genuinely changed behaviour —
 * a freshly opened create form would have read "0 of 2" — so it was a real blind spot over a stated
 * decision, not a mutant that failed to express one.
 */
describe('what the meter scores, exhaustively', () => {
  /**
   * The oracle: all four states of the two scored fields, enumerated and answered by hand.
   *
   * Written as a table rather than as `total - missing.length` because a test that re-derives the
   * count from the same rule list it is testing agrees with any rule list at all.
   */
  const cases: ReadonlyArray<{
    readonly name: string;
    readonly photoCount: number;
    readonly description: string | null | undefined;
    readonly expected: { done: number; total: number; missing: string[] };
  }> = [
    {
      name: 'a photo and a description',
      photoCount: 3,
      description: 'Tomato, mozzarella, basil',
      expected: { done: 2, total: 2, missing: [] },
    },
    {
      name: 'a description but no photo',
      photoCount: 0,
      description: 'Tomato, mozzarella, basil',
      expected: { done: 1, total: 2, missing: ['photo'] },
    },
    {
      name: 'a photo but no description',
      photoCount: 1,
      description: '',
      expected: { done: 1, total: 2, missing: ['description'] },
    },
    {
      name: 'neither',
      photoCount: 0,
      description: '',
      expected: { done: 0, total: 2, missing: ['photo', 'description'] },
    },
  ];

  it.each(cases)('scores an item with $name', ({ photoCount, description, expected }) => {
    expect(getProductCompleteness({ photoCount, description })).toEqual(expected);
  });

  it('reports the gaps in rule order, so the rail and the list read the same way round', () => {
    // Not incidental: the chips render in this order and so do the rail's rows. A `Set` or a filter
    // over an object's keys would make the order an accident of insertion.
    expect(getProductCompleteness({ photoCount: 0, description: '' }).missing).toEqual(['photo', 'description']);
    expect(COMPLETENESS_RULES.map((rule) => rule.id)).toEqual(['photo', 'description']);
  });

  it('treats a whitespace-only description as not written', () => {
    // The fixture is deliberately hostile: `'   '.length` is 3, so any rule that tests for a
    // non-empty string rather than a non-empty TRIMMED string passes vacuously here.
    expect(getProductCompleteness({ photoCount: 1, description: '   \n\t ' }).missing).toEqual(['description']);
  });

  it('treats a missing description field the same as an empty one', () => {
    expect(getProductCompleteness({ photoCount: 1 }).missing).toEqual(['description']);
    expect(getProductCompleteness({ photoCount: 1, description: null }).missing).toEqual(['description']);
  });
});

/**
 * The §14 decision, pinned as a value rather than as prose.
 *
 * This is the assertion to read before "improving" the meter. `allergens` is a plain `string[]`, so
 * an empty array is BOTH "the kitchen checked and there is nothing to declare" AND "nobody has
 * looked yet". Scoring it complete returns a green tick at the moment nobody has looked — a claim
 * about a legally mandatory particular — and scoring it incomplete nags an allergen-free dish
 * forever. So it is not scored at all, and the surface says so.
 *
 * If a future slice adds the recorded-check field (§14 option 1), this test goes red, and the person
 * who makes it green again is exactly the person who should have read §14 first.
 */
describe('allergens are not scored, and that is the decision', () => {
  it('scores exactly two fields, and neither is allergens', () => {
    expect(SCORED_COMPLETENESS_FIELDS).toEqual(['photo', 'description']);
    expect(SCORED_COMPLETENESS_FIELDS as readonly string[]).not.toContain('allergens');
  });

  it('calls an item with a photo, a description and no allergen data FULLY complete', () => {
    // The positive control for the decision: nothing about an absent allergen list may withhold a
    // tick, because the meter has no opinion about allergens at all.
    expect(getProductCompleteness({ photoCount: 1, description: 'Fries' })).toEqual({
      done: 2,
      total: 2,
      missing: [],
    });
  });
});

/**
 * The list-row adapter.
 *
 * The photo test reads `images`, never `imageUrl`, and that is MEASURED. The admin menu list is
 * served by `GetProductsQuery`, which projects every row through
 * `ProductSummaryMapper.MapToSummaryDto` — and that mapper fills `Images` and NEVER ASSIGNS
 * `ImageUrl`. Only `GetSpecialProductsQuery` and `GetFeaturedSpecialQuery` set it, and neither feeds
 * this page. A chip driven off `imageUrl` would have said "needs photo" about every row on the menu.
 */
describe('a menu-list row', () => {
  it('counts photos from `images`', () => {
    expect(getSummaryRowCompleteness({ description: 'x', images: [{ id: 'img-1' }] }).missing).toEqual([]);
    expect(getSummaryRowCompleteness({ description: 'x', images: [] }).missing).toEqual(['photo']);
  });

  it('ignores `imageUrl`, which this endpoint never populates', () => {
    // The negative control for the field choice: a row that carries a URL and an EMPTY `images`
    // still needs a photo here. Read `imageUrl` instead and this assertion is the one that fails.
    expect(
      getSummaryRowCompleteness({ description: 'x', images: [], imageUrl: '/uploads/x.jpg' } as Parameters<
        typeof getSummaryRowCompleteness
      >[0]).missing,
    ).toEqual(['photo']);
  });

  it('survives a row with neither field present', () => {
    expect(getSummaryRowCompleteness({})).toEqual({ done: 0, total: 2, missing: ['photo', 'description'] });
  });
});
