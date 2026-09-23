import type { CreateOrderDeliveryAddressDto } from '@/types/order';
import type { StaffCustomerSelection } from '@/types/staffCustomer';

/**
 * Who the counter sale is for, and — delivery only — where it goes (cashier POS plan §5.3.1:
 * customer identity is optional unless the channel requires it). Stored inside the versioned
 * new-sale draft; the server, not this object, decides what a channel still needs.
 */
export interface CashierNewSaleContact {
  customerUserId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  currentPoints?: number;
  pointsToRedeem?: number;
  deliveryAddress?: CreateOrderDeliveryAddressDto;
}

function asOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function readStoredDeliveryAddress(value: unknown): CreateOrderDeliveryAddressDto | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const row = value as Record<string, unknown>;
  if (typeof row.addressLine1 !== 'string' || row.addressLine1.trim() === '') return undefined;
  return {
    addressLine1: row.addressLine1.trim(),
    addressLine2: asOptionalText(row.addressLine2),
    city: asOptionalText(row.city) ?? '',
    postalCode: asOptionalText(row.postalCode) ?? '',
    country: asOptionalText(row.country) ?? '',
    phone: asOptionalText(row.phone),
    deliveryInstructions: asOptionalText(row.deliveryInstructions),
  };
}

function readFiniteNonnegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : undefined;
}

/** Defensive read of the stored contact block; anything unrecognizable reads as not entered. */
export function readStoredContact(value: unknown): CashierNewSaleContact | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const stored = value as Record<string, unknown>;
  const deliveryAddress = readStoredDeliveryAddress(stored.deliveryAddress);
  const customerName = asOptionalText(stored.customerName);
  const customerUserId = asOptionalText(stored.customerUserId);
  const customerEmail = asOptionalText(stored.customerEmail);
  const customerPhone = asOptionalText(stored.customerPhone);
  const currentPoints = readFiniteNonnegativeInteger(stored.currentPoints);
  const pointsRequested = readFiniteNonnegativeInteger(stored.pointsToRedeem);
  const pointsToRedeem =
    customerUserId && currentPoints !== undefined && pointsRequested !== undefined
      ? Math.min(currentPoints, pointsRequested)
      : undefined;
  if (!customerUserId && !customerName && !customerEmail && !customerPhone && !deliveryAddress) return undefined;
  return {
    ...(customerUserId !== undefined ? { customerUserId } : {}),
    ...(customerName !== undefined ? { customerName } : {}),
    ...(customerEmail !== undefined ? { customerEmail } : {}),
    ...(customerPhone !== undefined ? { customerPhone } : {}),
    ...(currentPoints !== undefined ? { currentPoints } : {}),
    ...(pointsToRedeem !== undefined ? { pointsToRedeem } : {}),
    ...(deliveryAddress !== undefined ? { deliveryAddress } : {}),
  };
}

export function customerSelectionFromContact(contact?: CashierNewSaleContact): StaffCustomerSelection | undefined {
  if (!contact) return undefined;
  return {
    customerUserId: contact.customerUserId,
    customerName: contact.customerName,
    customerEmail: contact.customerEmail,
    customerPhone: contact.customerPhone,
    currentPoints: contact.currentPoints,
    pointsToRedeem: contact.pointsToRedeem,
  };
}

export function contactWithCustomerSelection(
  contact: CashierNewSaleContact | undefined,
  selection: StaffCustomerSelection | undefined,
): CashierNewSaleContact | undefined {
  const { deliveryAddress } = contact ?? {};
  if (!selection) return deliveryAddress ? { deliveryAddress } : undefined;
  return {
    ...(selection.customerUserId ? { customerUserId: selection.customerUserId } : {}),
    ...(selection.customerName ? { customerName: selection.customerName } : {}),
    ...(selection.customerEmail ? { customerEmail: selection.customerEmail } : {}),
    ...(selection.customerPhone ? { customerPhone: selection.customerPhone } : {}),
    ...(selection.currentPoints !== undefined ? { currentPoints: selection.currentPoints } : {}),
    ...(selection.pointsToRedeem !== undefined ? { pointsToRedeem: selection.pointsToRedeem } : {}),
    ...(deliveryAddress ? { deliveryAddress } : {}),
  };
}
