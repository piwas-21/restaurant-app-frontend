import type { BillChargeInput, BillChargeRule } from '@/types/billCharge';
import type { OrderDto } from '@/types/order';

/** Advisory draft amounts. Accepted rule, currency rounding and allocation always belong to the server. */
export function billChargePreview(itemTotal: number, inputs: readonly BillChargeInput[]): number {
  return inputs.reduce((sum, input) => {
    const minor = BigInt(Math.round(itemTotal * 100));
    const basisPoints = BigInt(Math.round(input.amount * 100));
    const amount =
      input.calculation === 'Percentage'
        ? Number((minor * basisPoints + BigInt(5000)) / BigInt(10000)) / 100
        : input.amount;
    return sum + amount * (input.effect === 'Reduce' ? -1 : 1);
  }, 0);
}

export function billChargeItemBasis(order: OrderDto): number {
  if (order.billChargeItemBasis != null) return order.billChargeItemBasis;
  const food =
    order.total -
    Math.max(0, order.tip) -
    Math.min(Math.max(0, order.deliveryFee), order.total - Math.max(0, order.tip));
  return Math.max(
    0,
    food +
      (order.billCharges ?? []).filter((value) => value.amount < 0).reduce((sum, value) => sum + value.amount, 0) -
      (order.billingCreditAmount ?? 0),
  );
}

export function billChargeDraftMode(rule: BillChargeRule): Pick<BillChargeInput, 'effect' | 'calculation'> {
  if ((!rule.effect || rule.effect === 'Increase') && (!rule.calculation || rule.calculation === 'Fixed')) return {};
  return { effect: rule.effect ?? 'Increase', calculation: rule.calculation ?? 'Fixed' };
}

export function billChargeTicketTotal(
  items: readonly { unitPrice: number; quantity: number }[],
  inputs: readonly BillChargeInput[],
): number {
  const itemTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  return itemTotal + billChargePreview(itemTotal, inputs);
}
