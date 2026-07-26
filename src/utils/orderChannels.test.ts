import { OrderType } from '@/types/order';
import {
  ALL_ORDER_TYPES,
  exactMaskFromOrderTypes,
  isStorableMask,
  isUnrestricted,
  maskAllows,
  maskFromOrderTypes,
  orderTypesFromMask,
} from './orderChannels';

// The bit values (1/2/4) deliberately differ from the backend OrderType enum's numeric values
// (1/2/3). These tests pin the mapping and the permissive-null rule, mirroring the backend's
// OrderChannelMapTests — if the two drift, admin edits silently write the wrong channels.
describe('orderChannels', () => {
  describe('orderTypesFromMask', () => {
    it('treats null and undefined as unrestricted', () => {
      expect(orderTypesFromMask(null)).toEqual([...ALL_ORDER_TYPES]);
      expect(orderTypesFromMask(undefined)).toEqual([...ALL_ORDER_TYPES]);
    });

    it('decodes each single channel', () => {
      expect(orderTypesFromMask(1)).toEqual([OrderType.DineIn]);
      expect(orderTypesFromMask(2)).toEqual([OrderType.Takeaway]);
      expect(orderTypesFromMask(4)).toEqual([OrderType.Delivery]);
    });

    it('decodes the takeaway+delivery set the Dürüm case needs', () => {
      expect(orderTypesFromMask(6)).toEqual([OrderType.Takeaway, OrderType.Delivery]);
    });

    it('decodes an empty mask as nothing available', () => {
      expect(orderTypesFromMask(0)).toEqual([]);
    });

    it('returns types in declaration order regardless of bit order', () => {
      expect(orderTypesFromMask(5)).toEqual([OrderType.DineIn, OrderType.Delivery]);
    });
  });

  describe('maskFromOrderTypes', () => {
    it('collapses a full set to null so unrestricted rows store no mask', () => {
      expect(maskFromOrderTypes(ALL_ORDER_TYPES)).toBeNull();
    });

    it('encodes partial sets', () => {
      expect(maskFromOrderTypes([OrderType.Takeaway, OrderType.Delivery])).toBe(6);
      expect(maskFromOrderTypes([OrderType.DineIn])).toBe(1);
    });

    it('encodes an empty selection as 0, not null', () => {
      // 0 and null mean opposite things: 0 blocks every channel, null allows every channel.
      expect(maskFromOrderTypes([])).toBe(0);
    });

    it('round-trips every subset', () => {
      const subsets: OrderType[][] = [
        [OrderType.DineIn],
        [OrderType.Takeaway],
        [OrderType.Delivery],
        [OrderType.DineIn, OrderType.Takeaway],
        [OrderType.Takeaway, OrderType.Delivery],
        [OrderType.DineIn, OrderType.Delivery],
        [...ALL_ORDER_TYPES],
      ];
      for (const subset of subsets) {
        expect(orderTypesFromMask(maskFromOrderTypes(subset))).toEqual(subset);
      }
    });
  });

  describe('maskAllows', () => {
    it('is permissive for a null mask', () => {
      for (const type of ALL_ORDER_TYPES) {
        expect(maskAllows(null, type)).toBe(true);
      }
    });

    it('honours a partial mask', () => {
      expect(maskAllows(6, OrderType.Takeaway)).toBe(true);
      expect(maskAllows(6, OrderType.Delivery)).toBe(true);
      expect(maskAllows(6, OrderType.DineIn)).toBe(false);
    });

    it('blocks everything for mask 0', () => {
      for (const type of ALL_ORDER_TYPES) {
        expect(maskAllows(0, type)).toBe(false);
      }
    });
  });

  describe('exactMaskFromOrderTypes', () => {
    // The distinction products depend on: on a product `null` means INHERIT, so an explicit
    // all-three override must survive as 7. Collapsing it would hand a Dürüm item that an admin
    // deliberately opened to dine-in straight back to its takeaway-only category.
    it('keeps a full set as 7 instead of collapsing it to null', () => {
      expect(exactMaskFromOrderTypes(ALL_ORDER_TYPES)).toBe(7);
      expect(maskFromOrderTypes(ALL_ORDER_TYPES)).toBeNull();
    });

    it('agrees with maskFromOrderTypes on every partial set', () => {
      expect(exactMaskFromOrderTypes([OrderType.Takeaway, OrderType.Delivery])).toBe(6);
      expect(exactMaskFromOrderTypes([OrderType.DineIn])).toBe(1);
      expect(exactMaskFromOrderTypes([])).toBe(0);
    });
  });

  describe('isStorableMask', () => {
    it('accepts null/undefined (unrestricted) and every real subset', () => {
      expect(isStorableMask(null)).toBe(true);
      expect(isStorableMask(undefined)).toBe(true);
      for (let mask = 1; mask <= 7; mask += 1) {
        expect(isStorableMask(mask)).toBe(true);
      }
    });

    it('rejects 0 — the API refuses it, so admin surfaces must not offer to save it', () => {
      expect(isStorableMask(0)).toBe(false);
    });

    it('rejects out-of-range values', () => {
      expect(isStorableMask(8)).toBe(false);
      expect(isStorableMask(-1)).toBe(false);
    });
  });

  describe('isUnrestricted', () => {
    it('is true for null, undefined and an explicit full mask', () => {
      expect(isUnrestricted(null)).toBe(true);
      expect(isUnrestricted(undefined)).toBe(true);
      expect(isUnrestricted(7)).toBe(true);
    });

    it('is false for a partial mask and for none', () => {
      expect(isUnrestricted(6)).toBe(false);
      expect(isUnrestricted(0)).toBe(false);
    });
  });
});
