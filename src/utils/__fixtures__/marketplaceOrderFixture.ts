import type { OrderDto } from '@/types/order';
import { makeOrder, makeOrderItem } from './bundleOrderFixture';

/** Accepted provider example: €5 merchant charge, distinct from the €11.47 customer checkout. */
export function marketplaceOrder(): OrderDto {
  return {
    ...makeOrder([
      makeOrderItem({
        id: 'meal',
        productName: 'Test meal',
        unitPrice: 5,
        itemTotal: 5,
        specialInstructions: 'ALLERGY: no peanuts <script>unsafe()</script>',
      }),
    ]),
    type: 'Delivery',
    status: 'PendingApproval',
    currency: 'CHF',
    isKitchenReleased: false,
    subTotal: 5,
    total: 5,
    totalPaid: 5,
    remainingAmount: 0,
    tax: 0,
    notes: 'TEST ONLY: no food, no courier & keep instructions',
    externalOrder: {
      provider: 'uber-eats',
      externalDisplayId: '9116D',
      externalState: 'CREATED',
      lastEventAt: '2026-10-01T17:25:07Z',
      currency: 'EUR',
      merchantTotal: 5,
      reportedTax: null,
      fulfillmentType: 'DELIVERY_BY_UBER',
      isSandbox: true,
    },
  };
}
