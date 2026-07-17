import { stripTemporaryMenuSectionIds, isPersistedMenuId } from './menuSectionDraft';
import type { MenuSection } from '@/types/menu';

const section = (over: Partial<MenuSection> & { id: string }): MenuSection => ({
  name: 'Drink',
  description: 'Pick one',
  displayOrder: 1,
  isRequired: true,
  minSelection: 1,
  maxSelection: 1,
  items: [],
  ...over,
});

describe('isPersistedMenuId', () => {
  it('accepts a real id, rejects temp- placeholders and empties', () => {
    expect(isPersistedMenuId('abc-123')).toBe(true);
    expect(isPersistedMenuId('temp-xyz')).toBe(false);
    expect(isPersistedMenuId('')).toBe(false);
    expect(isPersistedMenuId(undefined)).toBe(false);
    expect(isPersistedMenuId(null)).toBe(false);
  });
});

describe('stripTemporaryMenuSectionIds', () => {
  it('keeps persisted section/item ids and omits temp- ones', () => {
    const sections: MenuSection[] = [
      section({
        id: 'sec-real',
        items: [
          { id: 'item-real', productId: 'p1', additionalPrice: 2, displayOrder: 1, isDefault: true },
          { id: 'temp-2', productId: 'p2', additionalPrice: 1, displayOrder: 2, isDefault: false },
        ],
      }),
      section({ id: 'temp-sec', displayOrder: 2, items: [] }),
    ];

    const [first, second] = stripTemporaryMenuSectionIds(sections);

    expect(first.id).toBe('sec-real');
    expect(first.items[0].id).toBe('item-real');
    expect('id' in first.items[1]).toBe(false); // temp item id dropped
    expect('id' in second).toBe(false); // temp section id dropped
  });

  it('carries only the create/update fields (drops productName, detailedIngredients, etc.)', () => {
    const sections: MenuSection[] = [
      section({
        id: 'sec-real',
        items: [
          {
            id: 'item-real',
            productId: 'p1',
            productName: 'Cola', // display-only, must not survive
            additionalPrice: 2,
            displayOrder: 1,
            isDefault: true,
            detailedIngredients: [],
          },
        ],
      }),
    ];

    const [cleaned] = stripTemporaryMenuSectionIds(sections);

    expect(cleaned.items[0]).toEqual({
      id: 'item-real',
      productId: 'p1',
      additionalPrice: 2,
      displayOrder: 1,
      isDefault: true,
    });
    expect(cleaned).toEqual({
      id: 'sec-real',
      name: 'Drink',
      description: 'Pick one',
      displayOrder: 1,
      isRequired: true,
      minSelection: 1,
      maxSelection: 1,
      items: cleaned.items,
    });
  });
});
