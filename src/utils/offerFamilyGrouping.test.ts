import type { Product } from '@/app/admin/menu-management/interfaces';
import { groupProductsIntoOfferRows } from './offerFamilyGrouping';

const row = (id: string, type: string, parentOfferProductId?: string): Product => ({
  id,
  name: id,
  description: '',
  basePrice: 10,
  isActive: true,
  isAvailable: true,
  type,
  imageUrl: null,
  images: [],
  parentOfferProductId,
});

describe('groupProductsIntoOfferRows', () => {
  it('groups an explicit parent and menu offer while preserving both underlying rows', () => {
    const rows = groupProductsIntoOfferRows([row('base', 'mainItem'), row('menu', 'menu', 'base')]);

    expect(rows).toEqual([
      {
        kind: 'family',
        anchor: expect.objectContaining({ id: 'base' }),
        menuOffers: [expect.objectContaining({ id: 'menu' })],
      },
    ]);
  });

  it('never guesses a family from a shared name', () => {
    const rows = groupProductsIntoOfferRows([row('base', 'mainItem'), row('menu', 'menu')]);

    expect(rows.map((entry) => entry.kind)).toEqual(['independent', 'independent']);
  });

  it('keeps a linked menu visible when the parent is outside the current page', () => {
    const rows = groupProductsIntoOfferRows([row('menu', 'menu', 'base-outside-page')]);

    expect(rows).toEqual([{ kind: 'independent', product: expect.objectContaining({ id: 'menu' }) }]);
  });

  it('supports more than one menu offer without duplicating a child row', () => {
    const rows = groupProductsIntoOfferRows([
      row('base', 'mainItem'),
      row('menu-a', 'menu', 'base'),
      row('menu-b', 'menu', 'base'),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'family', menuOffers: [{ id: 'menu-a' }, { id: 'menu-b' }] });
  });

  it('does not duplicate a child when the API returns it before its anchor', () => {
    const rows = groupProductsIntoOfferRows([row('menu', 'menu', 'base'), row('base', 'mainItem')]);

    expect(rows).toEqual([
      {
        kind: 'family',
        anchor: expect.objectContaining({ id: 'base' }),
        menuOffers: [expect.objectContaining({ id: 'menu' })],
      },
    ]);
  });
});
