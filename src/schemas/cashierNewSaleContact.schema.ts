import { z } from 'zod';
import { OrderType } from '@/types/order';

/**
 * The counter-sale contact block (pilot feedback: the Delivery channel refused to create with
 * "delivery address is required" while giving the cashier nowhere to type one). Delivery
 * requires the postal triplet; every other field — and everything on takeaway/dine-in — is
 * optional for a cashier, who may not know the customer the way the public menu asks it.
 */
export function cashierNewSaleContactSchema(channel: OrderType | null) {
  const addressLine1 = z.string().trim().max(200);
  const city = z.string().trim().max(80);
  const postalCode = z.string().trim().max(20);
  const country = z.string().trim().max(60);
  return z.object({
    customerName: z.string().trim().max(120),
    customerPhone: z.string().trim().max(30),
    addressLine1: channel === OrderType.Delivery ? addressLine1.min(1) : addressLine1,
    addressLine2: z.string().trim().max(200),
    city: channel === OrderType.Delivery ? city.min(1) : city,
    postalCode: channel === OrderType.Delivery ? postalCode.min(1) : postalCode,
    country: channel === OrderType.Delivery ? country.min(1) : country,
    deliveryInstructions: z.string().trim().max(500),
  });
}

export type CashierNewSaleContactFormValues = z.infer<ReturnType<typeof cashierNewSaleContactSchema>>;
