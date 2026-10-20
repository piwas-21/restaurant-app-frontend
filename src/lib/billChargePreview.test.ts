import { billChargePreview, billChargeItemBasis } from './billChargePreview';
import { makeOrder } from '@/utils/__fixtures__/bundleOrderFixture';

it('applies percentages to item totals and combines signed fixed adjustments', () => {
  expect(
    billChargePreview(20, [
      { key: 'discount', amount: 10, effect: 'Reduce', calculation: 'Percentage' },
      { key: 'delivery', amount: 3 },
    ]),
  ).toBe(1);
  expect(billChargePreview(20, [{ key: 'discount', amount: 4, effect: 'Reduce' }])).toBe(-4);
  expect(billChargePreview(20, [{ key: 'discount', amount: 100, effect: 'Reduce', calculation: 'Percentage' }])).toBe(
    -20,
  );
});

it('excludes fees, tips, prior reductions and removed food from the next percentage basis', () => {
  expect(
    billChargeItemBasis({
      ...makeOrder([]),
      total: 25,
      tip: 2,
      deliveryFee: 3,
      billingCreditAmount: 8,
      billCharges: [{ key: 'discount', label: 'Discount', amount: -4, currency: 'EUR' }],
    }),
  ).toBe(8);
});

it('rounds a half cent from decimal minor units exactly as the server', () => {
  expect(billChargePreview(0.29, [{ key: 'discount', amount: 50, effect: 'Reduce', calculation: 'Percentage' }])).toBe(
    -0.15,
  );
});
