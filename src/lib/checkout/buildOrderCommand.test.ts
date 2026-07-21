import { buildOrderCommand, type BuildOrderCommandParams } from './buildOrderCommand';
import { PaymentMethod } from '@/types/order';
import type { BasketDto } from '@/types/basket';

const basket = {
  subTotal: 100,
  tax: 8,
  discount: 5,
  customerDiscount: 2,
  total: 101,
  promoCode: 'SAVE10',
} as unknown as BasketDto;

const base: BuildOrderCommandParams = {
  orderType: 'Takeaway' as BuildOrderCommandParams['orderType'],
  customerName: 'Ada',
  customerEmail: 'ada@calc.co',
  customerPhone: '+41790000000',
  tableNumber: '',
  deliveryAddress: null,
  specialInstructions: '',
  tipAmount: 0,
  basket,
  paymentMethod: PaymentMethod.Cash,
  pointsDiscount: 0,
  redeemedPoints: 0,
};

describe('buildOrderCommand', () => {
  it('passes contact, type, promo and basket pre-calculated totals through', () => {
    const cmd = buildOrderCommand(base);
    expect(cmd).toMatchObject({
      customerName: 'Ada',
      customerEmail: 'ada@calc.co',
      customerPhone: '+41790000000',
      type: 'Takeaway',
      promoCode: 'SAVE10',
      basketSubTotal: 100,
      basketTax: 8,
      basketDiscount: 5,
      basketCustomerDiscount: 2,
      pointsToRedeem: 0,
      tip: 0,
    });
  });

  it('computes the payable total as basket.total − pointsDiscount + tip (payment + basketTotal)', () => {
    const cmd = buildOrderCommand({ ...base, pointsDiscount: 6, tipAmount: 10 });
    // 101 − 6 + 10 = 105
    expect(cmd.payments).toEqual([{ paymentMethod: PaymentMethod.Cash, amount: 105 }]);
    expect(cmd.basketTotal).toBe(105);
    expect(cmd.tip).toBe(10);
  });

  it('builds a delivery address only for a Delivery order with an address', () => {
    const address = {
      street: 'Rue 1',
      city: 'Geneva',
      postalCode: '1201',
      country: 'CH',
      additionalInfo: 'ring twice',
    } as BuildOrderCommandParams['deliveryAddress'];
    const cmd = buildOrderCommand({ ...base, orderType: 'Delivery' as never, deliveryAddress: address });
    expect(cmd.deliveryAddress).toEqual({
      addressLine1: 'Rue 1',
      city: 'Geneva',
      postalCode: '1201',
      country: 'CH',
      deliveryInstructions: 'ring twice',
    });
  });

  it('omits the delivery address for a non-Delivery order even if one is present', () => {
    const address = { street: 'x', city: 'y', postalCode: 'z', country: 'CH' } as never;
    const cmd = buildOrderCommand({ ...base, orderType: 'Takeaway' as never, deliveryAddress: address });
    expect(cmd.deliveryAddress).toBeUndefined();
  });

  it('parses the table number only for a DineIn order with a table', () => {
    expect(buildOrderCommand({ ...base, orderType: 'DineIn' as never, tableNumber: '12' }).tableNumber).toBe(12);
    expect(buildOrderCommand({ ...base, orderType: 'DineIn' as never, tableNumber: '' }).tableNumber).toBeUndefined();
    expect(
      buildOrderCommand({ ...base, orderType: 'Takeaway' as never, tableNumber: '12' }).tableNumber,
    ).toBeUndefined();
  });

  it('maps empty special instructions + missing basket to undefined/zeroed totals', () => {
    const cmd = buildOrderCommand({ ...base, specialInstructions: '', basket: null });
    expect(cmd.notes).toBeUndefined();
    expect(cmd.promoCode).toBeUndefined();
    expect(cmd.basketSubTotal).toBeUndefined();
    expect(cmd.payments?.[0]?.amount).toBe(0);
  });
});
