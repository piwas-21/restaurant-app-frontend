import type { AccountPaymentAllocation } from '@/types/accountPayments';
import { accountAllocationKey, selectAccountPaymentUnits } from './accountPaymentSelection';

const line: AccountPaymentAllocation = {
  orderId: 'round-one',
  orderItemId: 'soup',
  startOrdinal: 3,
  unitCount: 1000000,
  minorPerUnit: 333,
  amountMinor: 333000000,
};

describe('compact payable item ranges', () => {
  it('selects reviewed remaining unit ordinals without expanding the whole account', () => {
    expect(selectAccountPaymentUnits([line], { [accountAllocationKey(line)]: 2 }, 250)).toEqual([
      { orderId: 'round-one', orderItemId: 'soup', ordinal: 3 },
      { orderId: 'round-one', orderItemId: 'soup', ordinal: 4 },
    ]);
  });

  it('refuses stale ranges, unknown selections, and contributions above the server limit', () => {
    expect(selectAccountPaymentUnits([line], { [accountAllocationKey(line)]: 251 }, 250)).toBeNull();
    expect(selectAccountPaymentUnits([line], { old: 1 }, 250)).toBeNull();
    expect(selectAccountPaymentUnits([{ ...line, unitCount: 1 }], { [accountAllocationKey(line)]: 2 }, 250)).toBeNull();
  });

  it('never turns an unitemized charge into invented item ownership', () => {
    const charge = { ...line, orderItemId: null, startOrdinal: 1, unitCount: 1 };
    expect(selectAccountPaymentUnits([charge], { [accountAllocationKey(charge)]: 1 }, 250)).toBeNull();
  });

  it('refuses overlapping unit identities even when ranges have different starts', () => {
    const overlap = { ...line, startOrdinal: 4, unitCount: 1 };
    expect(
      selectAccountPaymentUnits(
        [line, overlap],
        {
          [accountAllocationKey(line)]: 2,
          [accountAllocationKey(overlap)]: 1,
        },
        250,
      ),
    ).toBeNull();
  });
});
