import { OrderType } from '@/types/order';
import { mapProductDtoToMenuItem } from './mappers';
import type { ProductDto } from './types';

/**
 * The `availability` half of the public-menu product mapper (S4).
 *
 * Every case here is about the same invariant: this feature fails PERMISSIVELY. Dimming a sellable
 * item because a payload was odd costs a sale and gives the guest nothing to act on, so anything the
 * mapper cannot trust becomes "no restriction to report" rather than "blocked".
 */
const base: ProductDto = { id: 'p1', name: 'Dürüm', basePrice: 12 };

describe('mapProductDtoToMenuItem — availability', () => {
  it('carries a real verdict through unchanged', () => {
    const mapped = mapProductDtoToMenuItem({
      ...base,
      availability: {
        canOrder: false,
        reason: 'WrongOrderType',
        allowedOrderTypes: ['Takeaway', 'Delivery'],
      },
    });

    expect(mapped.availability).toEqual({
      canOrder: false,
      reason: 'WrongOrderType',
      allowedOrderTypes: [OrderType.Takeaway, OrderType.Delivery],
    });
  });

  it('reports nothing when the backend omits the field — an older API must not dim the menu', () => {
    expect(mapProductDtoToMenuItem(base).availability).toBeUndefined();
  });

  it('reports nothing for an EMPTY allowed list — the backend cannot store an empty mask, so it is bad data', () => {
    const mapped = mapProductDtoToMenuItem({
      ...base,
      availability: { canOrder: false, reason: 'WrongOrderType', allowedOrderTypes: [] },
    });

    // "Blocked everywhere with no stateable reason" is exactly the state this must never render.
    expect(mapped.availability).toBeUndefined();
  });

  it('drops channel values it does not recognise rather than trusting them', () => {
    const mapped = mapProductDtoToMenuItem({
      ...base,
      availability: { canOrder: true, reason: 'Available', allowedOrderTypes: ['Takeaway', 'Teleport'] },
    });

    expect(mapped.availability?.allowedOrderTypes).toEqual([OrderType.Takeaway]);
  });

  it("defaults a missing canOrder to true — matching the DTO's own permissive default", () => {
    const mapped = mapProductDtoToMenuItem({
      ...base,
      availability: { allowedOrderTypes: ['Takeaway'] },
    });

    expect(mapped.availability).toMatchObject({ canOrder: true, reason: 'Available' });
  });

  it('never lets an unknown reason contradict the verdict', () => {
    // A card that dims with reason "Available" has nothing to say; the reason follows the verdict.
    const mapped = mapProductDtoToMenuItem({
      ...base,
      availability: { canOrder: false, reason: 'SomethingNew', allowedOrderTypes: ['Takeaway'] },
    });

    expect(mapped.availability).toMatchObject({ canOrder: false, reason: 'WrongOrderType' });
  });
});
