import {
  EXCLUSION_GROUP_MAX_LENGTH,
  exclusionGroupKey,
  exclusiveSiblingIds,
  siblingsToDeselect,
} from '../exclusionGroup';

/**
 * The mutual-exclusion rule (SHARED-MODIFIERS-AND-SAUCES-PLAN §9), tested where it is pure.
 *
 * The oracles here are hand-written, not derived from the implementation: each case says what the
 * guest should end up with, and the interesting ones are the DEGRADES — an ungrouped row, a group
 * of one, and a blank key, all of which must behave exactly as an ingredient did before this field
 * existed, because that is every row on production today.
 */
const rows = [
  { id: 'rare', exclusionGroup: 'doneness' },
  { id: 'medium', exclusionGroup: 'doneness' },
  { id: 'well', exclusionGroup: ' doneness ' },
  { id: 'white', exclusionGroup: 'bread' },
  { id: 'brown', exclusionGroup: 'bread' },
  { id: 'bacon' },
  { id: 'cheese', exclusionGroup: '' },
  { id: 'egg', exclusionGroup: '   ' },
  { id: 'lonely', exclusionGroup: 'sides' },
];

describe('exclusionGroupKey', () => {
  it('trims, so a key that LOOKS the same IS the same', () => {
    expect(exclusionGroupKey({ id: 'well', exclusionGroup: ' doneness ' })).toBe('doneness');
  });

  it.each([undefined, null, '', '   '])('treats %p as no group at all', (value) => {
    expect(exclusionGroupKey({ id: 'x', exclusionGroup: value })).toBeNull();
  });

  it('is null for a row that has no such field', () => {
    expect(exclusionGroupKey({ id: 'bacon' })).toBeNull();
  });
});

describe('exclusiveSiblingIds', () => {
  it('names the other members of the group, and only them', () => {
    expect(exclusiveSiblingIds(rows, 'rare').sort()).toEqual(['medium', 'well']);
    expect(exclusiveSiblingIds(rows, 'white')).toEqual(['brown']);
  });

  it('is empty for an ungrouped row — the state every ingredient on prod is in', () => {
    expect(exclusiveSiblingIds(rows, 'bacon')).toEqual([]);
  });

  it.each(['cheese', 'egg'])('is empty for a blank key (%s), which is NOT an anonymous group', (id) => {
    expect(exclusiveSiblingIds(rows, id)).toEqual([]);
  });

  it('is empty for a group of ONE, which degrades to an ordinary checkbox', () => {
    expect(exclusiveSiblingIds(rows, 'lonely')).toEqual([]);
  });

  it('never returns the row itself, whatever the group size', () => {
    for (const row of rows) {
      expect(exclusiveSiblingIds(rows, row.id)).not.toContain(row.id);
    }
  });

  it('is empty for an id the list does not hold, rather than grouping every keyless row together', () => {
    expect(exclusiveSiblingIds(rows, 'not-a-row')).toEqual([]);
  });

  it('handles an absent list', () => {
    expect(exclusiveSiblingIds(undefined, 'rare')).toEqual([]);
  });
});

describe('siblingsToDeselect', () => {
  it('names only the siblings that are actually ON the line', () => {
    expect(siblingsToDeselect(rows, 'rare', ['medium', 'bacon'])).toEqual(['medium']);
  });

  it('is empty when the group is empty of selections — no quantity 0 for a row nobody picked', () => {
    expect(siblingsToDeselect(rows, 'rare', ['bacon', 'white'])).toEqual([]);
  });

  it('accepts a Set as well as an array, because the two sheets hold the selection differently', () => {
    expect(siblingsToDeselect(rows, 'white', new Set(['brown']))).toEqual(['brown']);
  });

  it('leaves a DIFFERENT group alone: choosing a bread does not disturb the doneness answer', () => {
    expect(siblingsToDeselect(rows, 'white', ['brown', 'medium'])).toEqual(['brown']);
  });
});

describe('EXCLUSION_GROUP_MAX_LENGTH', () => {
  // Mirrors `ProductIngredient.ExclusionGroupMaxLength` on the server. If the column ever widens,
  // this number and that constant move together — the admin input caps at it so a key the API
  // would refuse cannot be typed.
  it('is the stored width of the column', () => {
    expect(EXCLUSION_GROUP_MAX_LENGTH).toBe(40);
  });
});
