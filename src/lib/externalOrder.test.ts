import { channelProviderName, reportedOrderTax, permitsChannelLocalAction } from './externalOrder';
import { canCollectPayment } from './settlementEligibility';
import { orderCurrency } from './cashierMoney';
import { marketplaceOrder } from '@/utils/__fixtures__/marketplaceOrderFixture';
import { makeOrder } from '@/utils/__fixtures__/bundleOrderFixture';

it('uses the frozen EUR source even when tenant money says CHF', () => {
  expect(orderCurrency(marketplaceOrder())).toBe('EUR');
});
it('distinguishes unknown provider tax, explicit zero and ordinary recorded tax', () => {
  const order = marketplaceOrder();
  expect(reportedOrderTax(order)).toBeNull();
  order.externalOrder!.reportedTax = 0;
  expect(reportedOrderTax(order)).toBe(0);
  order.externalOrder!.reportedTax = 0.45;
  expect(reportedOrderTax(order)).toBe(0.45);
  expect(reportedOrderTax({ ...makeOrder([]), tax: 1.8 })).toBe(1.8);
});
it('requires an explicit server permission for channel actions, while retaining ordinary behavior', () => {
  const order = marketplaceOrder();
  expect(permitsChannelLocalAction(order, 'PrintKitchen')).toBe(false);
  order.permittedActions = [{ action: 'PrintKitchen', allowed: true, requiresReason: false }];
  expect(permitsChannelLocalAction(order, 'PrintKitchen')).toBe(true);
  expect(permitsChannelLocalAction(order, 'PrintReceipt')).toBe(false);
  expect(permitsChannelLocalAction(makeOrder([]), 'PrintReceipt')).toBe(true);
});
it('does not collect locally even if a provider-managed order has apparent debt', () => {
  expect(canCollectPayment({ ...marketplaceOrder(), remainingAmount: 5 })).toBe(false);
});
it('translates known providers and preserves an unknown provider identifier', () => {
  const source = marketplaceOrder().externalOrder!;
  expect(channelProviderName(source, (_key, fallback) => fallback)).toBe('Uber Eats');
  expect(channelProviderName({ ...source, provider: 'new-channel' }, (_key, fallback) => fallback)).toBe('new-channel');
});
