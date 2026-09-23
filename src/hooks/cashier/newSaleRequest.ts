import { OrderType, type StaffCounterOrderRequest } from '@/types/order';
import type { CashierNewSaleDraftLine } from '@/lib/cashierNewSaleDraft';
import type { CashierNewSaleContact } from '@/lib/cashierNewSaleContact';
import { buildOrderItems } from '@/components/catalog/orderItems';

/**
 * The counter-sale wire request, assembled in exactly one place so the payload cannot drift
 * from the backend contract (backend `StaffCounterOrderRequest`): dine-in carries the table
 * number and its resolved open session, every other channel carries neither, and payment state
 * is always Unpaid — collecting money is the collection route's separate idempotent action.
 */

/** Counter-sale preference order: a walk-up sale is a takeaway unless the tenant disabled it. */
const CHANNEL_PREFERENCE: readonly OrderType[] = [OrderType.Takeaway, OrderType.DineIn, OrderType.Delivery];

export function defaultChannelFor(enabled: readonly OrderType[]): OrderType {
  return CHANNEL_PREFERENCE.find((channel) => enabled.includes(channel)) ?? OrderType.Takeaway;
}

/** The backend requires a positive integer table number for dine-in. */
export function parseTableNumber(raw: string): number | null {
  const parsed = Number(raw.trim());
  return raw.trim() !== '' && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export interface CounterSaleInput {
  channel: OrderType;
  lines: readonly CashierNewSaleDraftLine[];
  notes: string;
  tableNumber?: number;
  serviceSessionId?: string;
  contact?: CashierNewSaleContact;
  loyaltyEnabled?: boolean;
}

export function buildCounterSaleRequest(input: CounterSaleInput): StaffCounterOrderRequest {
  const dineIn = input.channel === OrderType.DineIn;
  const delivery = input.channel === OrderType.Delivery;
  return {
    type: input.channel,
    items: buildOrderItems(input.lines),
    notes: input.notes.trim() || undefined,
    paymentState: 'Unpaid',
    customerName: input.contact?.customerName,
    customerUserId: input.contact?.customerUserId,
    customerEmail: input.contact?.customerEmail,
    customerPhone: input.contact?.customerPhone,
    ...(input.loyaltyEnabled && input.contact?.customerUserId && input.contact.pointsToRedeem
      ? { pointsToRedeem: input.contact.pointsToRedeem }
      : {}),
    // The wire field exists only for delivery (the server validator refuses it elsewhere); the
    // quote echoes the same payload so the reviewed price includes the channel's terms.
    ...(delivery && input.contact?.deliveryAddress !== undefined
      ? { deliveryAddress: input.contact.deliveryAddress }
      : {}),
    ...(dineIn && input.tableNumber !== undefined ? { tableNumber: input.tableNumber } : {}),
    ...(dineIn && input.serviceSessionId !== undefined ? { serviceSessionId: input.serviceSessionId } : {}),
  };
}
