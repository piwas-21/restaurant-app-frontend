import {
  applySideItemDraft,
  isSelfSuggestion,
  resultsNotAlreadyListed,
  sideItemDraftChanged,
  sideItemLabel,
  toggleSideItem,
} from './sideItemPicker';
import type { ProductSearchResult } from './types';

/**
 * The add-AND-remove rules of the side-item picker, without a render and without a network
 * (MENU-ITEM-EDITOR-REDESIGN-PLAN **D12**, slice S9).
 *
 * **The defect these exist to end**, quoted from the code they replace:
 *
 *     const newSelectedIds = Array.from(new Set([...selectedSideItemIds, ...tempSelectedIds]));
 *
 * A MERGE. Whatever the admin unticked was merged straight back in, so the picker could only ever
 * grow the list. `applySideItemDraft` replaces rather than merges, which is the single change that
 * makes one tick box mean both directions.
 *
 * MEASURED mutation signatures — each one was applied to the tree, the suite was run, and the tests
 * below are the ones that actually went red. Stated by test NAME because counts decay as the suite
 * grows. Every mutation here goes RED, which is its own proof that it applied: a no-op edit cannot
 * turn a passing test red.
 *
 * | mutation | what goes red |
 * |---|---|
 * | `apply` merges the draft into the current list (restore the old bug) | `SuggestedSideItemsPicker › writes the picker's answer straight through, unmerged` + `SideItemPickerModal › unticking an already-suggested item removes it` + `ProductEditorRoundTrip › a side item removed in the picker is absent from the PUT` |
 * | drop the `isSelfSuggestion` filter from `applySideItemDraft` | `refuses to suggest the product being edited, even when the stored list already does` + `sideItemDraftChanged › offers the repair when the stored list holds the product itself` + `SideItemPickerModal › repairs a stored list that already holds the dish itself` |
 * | drop the `seen` de-duplication | `de-duplicates a stored list the schema never promised was a set` |
 * | `toggleSideItem` appends without the `includes` guard | `ticking a row that is already in the draft does not add it twice` |
 * | `resultsNotAlreadyListed` returns `results` unchanged | `hides a search hit that the currently-suggested group already lists` + `SideItemPickerModal › does not offer a second tick box for an item it already suggests` |
 * | `sideItemDraftChanged` compares two CLEANED lists | `offers the repair when the stored list holds the product itself` + `SideItemPickerModal › repairs a stored list that already holds the dish itself` |
 */

const ID_A = 'side-a';
const ID_B = 'side-b';
const SELF = 'the-dish-being-edited';

// `ProductType` has no `sideItem` member — a side item is any product the admin chooses to suggest,
// which is exactly why `useSideItemSearch` applies no type filter.
const result = (id: string, name: string): ProductSearchResult => ({
  id,
  name,
  description: '',
  basePrice: 4,
  type: 'addOn',
});

describe('toggleSideItem', () => {
  it('appends a ticked row at the end and keeps the order of the rest', () => {
    expect(toggleSideItem([ID_A, ID_B], 'side-c', true)).toEqual([ID_A, ID_B, 'side-c']);
  });

  it('removes an unticked row — the half the surface this replaces had no control for', () => {
    expect(toggleSideItem([ID_A, ID_B], ID_A, false)).toEqual([ID_B]);
  });

  it('ticking a row that is already in the draft does not add it twice', () => {
    expect(toggleSideItem([ID_A], ID_A, true)).toEqual([ID_A]);
  });

  it('does not mutate the draft it was given', () => {
    const draft = [ID_A];
    toggleSideItem(draft, ID_B, true);
    expect(draft).toEqual([ID_A]);
  });
});

describe('applySideItemDraft', () => {
  it('returns the draft, which is a REPLACEMENT and not a merge', () => {
    // The oracle is the draft itself: whatever was ticked when Apply was pressed is the whole
    // answer. Under the merge this replaces, `[]` came back as `[ID_A, ID_B]`.
    expect(applySideItemDraft([ID_B])).toEqual([ID_B]);
    expect(applySideItemDraft([])).toEqual([]);
  });

  it('refuses to suggest the product being edited, even when the stored list already does', () => {
    // Not hypothetical: nothing in `searchProducts` or in `UpdateProductCommand` refuses a
    // self-reference, so a list that already holds one is repaired by the next apply.
    expect(applySideItemDraft([ID_A, SELF, ID_B], SELF)).toEqual([ID_A, ID_B]);
  });

  it('de-duplicates a stored list the schema never promised was a set', () => {
    expect(applySideItemDraft([ID_A, ID_B, ID_A])).toEqual([ID_A, ID_B]);
  });

  it('leaves every other id alone when there is no product id to exclude (the create route)', () => {
    // The control: without it a `filter` that dropped everything would pass the two tests above.
    expect(applySideItemDraft([ID_A, SELF, ID_B], undefined)).toEqual([ID_A, SELF, ID_B]);
  });
});

describe('isSelfSuggestion', () => {
  it('is false for every id when the product has no id yet', () => {
    expect(isSelfSuggestion(ID_A, undefined)).toBe(false);
    expect(isSelfSuggestion('', undefined)).toBe(false);
  });

  it('is true only for the product being edited', () => {
    expect(isSelfSuggestion(SELF, SELF)).toBe(true);
    expect(isSelfSuggestion(ID_A, SELF)).toBe(false);
  });
});

describe('resultsNotAlreadyListed', () => {
  it('hides a search hit that the currently-suggested group already lists', () => {
    const rows = [result(ID_A, 'Fries'), result(ID_B, 'Salad')];
    expect(resultsNotAlreadyListed(rows, [ID_A])).toEqual([result(ID_B, 'Salad')]);
  });

  it('keeps every hit when nothing is suggested yet', () => {
    const rows = [result(ID_A, 'Fries'), result(ID_B, 'Salad')];
    expect(resultsNotAlreadyListed(rows, [])).toEqual(rows);
  });
});

describe('sideItemDraftChanged', () => {
  it('is false for a picker that was opened and closed without a tick', () => {
    // Why it matters: the one Save is gated on `isDirty`, so a needless write would report unsaved
    // changes the admin never made.
    expect(sideItemDraftChanged([ID_A, ID_B], [ID_A, ID_B])).toBe(false);
  });

  it('sees an addition, a removal, and a reorder alike', () => {
    expect(sideItemDraftChanged([ID_A], [ID_A, ID_B])).toBe(true);
    expect(sideItemDraftChanged([ID_A, ID_B], [ID_B])).toBe(true);
    expect(sideItemDraftChanged([ID_A, ID_B], [ID_B, ID_A])).toBe(true);
  });

  it('offers the repair when the stored list holds the product itself', () => {
    // Compared against the RAW stored list, so the self-reference still reads as a change worth
    // applying. Comparing two cleaned lists would report `false` and leave the bad row on the
    // product for ever.
    expect(sideItemDraftChanged([SELF, ID_A], [SELF, ID_A], SELF)).toBe(true);
  });
});

describe('sideItemLabel', () => {
  const details = new Map([[ID_A, { name: 'Fries' }]]);

  it('prefers the fetched detail, then the search hit on screen, then the id', () => {
    expect(sideItemLabel(ID_A, details, [result(ID_A, 'Chips')])).toBe('Fries');
    expect(sideItemLabel(ID_B, details, [result(ID_B, 'Salad')])).toBe('Salad');
    expect(sideItemLabel('3f2a9c11-0000-0000-0000-000000000000', details)).toBe('Item 3f2a9c11...');
  });
});
