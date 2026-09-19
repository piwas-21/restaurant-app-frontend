import type { CreateOrderDeliveryAddressDto } from '@/types/order';

/**
 * Who the counter sale is for, and — delivery only — where it goes (cashier POS plan §5.3.1:
 * customer identity is optional unless the channel requires it). Stored inside the versioned
 * new-sale draft; the server, not this object, decides what a channel still needs.
 */
export interface CashierNewSaleContact {
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: CreateOrderDeliveryAddressDto;
}

function asOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** Defensive read of the stored contact block; anything unrecognizable reads as not entered. */
export function readStoredContact(value: unknown): CashierNewSaleContact | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const stored = value as Record<string, unknown>;
  const address = stored.deliveryAddress;
  let deliveryAddress: CreateOrderDeliveryAddressDto | undefined;
  if (typeof address === 'object' && address !== null) {
    const row = address as Record<string, unknown>;
    if (typeof row.addressLine1 === 'string' && row.addressLine1.trim() !== '') {
      deliveryAddress = {
        addressLine1: row.addressLine1.trim(),
        addressLine2: asOptionalText(row.addressLine2),
        city: asOptionalText(row.city) ?? '',
        postalCode: asOptionalText(row.postalCode) ?? '',
        country: asOptionalText(row.country) ?? '',
        phone: asOptionalText(row.phone),
        deliveryInstructions: asOptionalText(row.deliveryInstructions),
      };
    }
  }
  const customerName = asOptionalText(stored.customerName);
  const customerPhone = asOptionalText(stored.customerPhone);
  if (!customerName && !customerPhone && !deliveryAddress) return undefined;
  return {
    ...(customerName !== undefined ? { customerName } : {}),
    ...(customerPhone !== undefined ? { customerPhone } : {}),
    ...(deliveryAddress !== undefined ? { deliveryAddress } : {}),
  };
}
