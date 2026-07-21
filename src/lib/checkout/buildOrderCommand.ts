// Pure builder for the from-basket order command (extracted from the review
// page's inline handlePlaceOrder so the page hook stays lean and the payload
// mapping is unit-testable). The server reads the persisted basket via the
// X-Session-Id header and derives the items itself — the client only passes the
// contact/type/tip/points and the basket's pre-calculated totals for
// consistency (menu-bundles redesign #157, slice 5).
import type { DeliveryAddress } from '@/contexts/CheckoutContext';
import type { BasketDto } from '@/types/basket';
import {
  PaymentMethod,
  CreateOrderFromBasketCommand,
  CreateOrderDeliveryAddressDto,
  OrderType as OrderTypeEnum,
} from '@/types/order';

export interface BuildOrderCommandParams {
  orderType: OrderTypeEnum;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  tableNumber: string;
  deliveryAddress: DeliveryAddress | null;
  specialInstructions: string;
  tipAmount: number;
  basket: BasketDto | null | undefined;
  paymentMethod: PaymentMethod;
  pointsDiscount: number;
  redeemedPoints: number;
}

export function buildOrderCommand(params: Readonly<BuildOrderCommandParams>): CreateOrderFromBasketCommand {
  const {
    orderType,
    customerName,
    customerEmail,
    customerPhone,
    tableNumber,
    deliveryAddress,
    specialInstructions,
    tipAmount,
    basket,
    paymentMethod,
    pointsDiscount,
    redeemedPoints,
  } = params;

  let deliveryAddressDto: CreateOrderDeliveryAddressDto | undefined;
  if (orderType === 'Delivery' && deliveryAddress) {
    deliveryAddressDto = {
      addressLine1: deliveryAddress.street,
      city: deliveryAddress.city,
      postalCode: deliveryAddress.postalCode,
      country: deliveryAddress.country,
      deliveryInstructions: deliveryAddress.additionalInfo,
    };
  }

  const payableTotal = (basket?.total || 0) - pointsDiscount + (tipAmount || 0);

  return {
    customerName,
    customerEmail,
    customerPhone,
    type: orderType,
    tableNumber: orderType === 'DineIn' && tableNumber ? parseInt(tableNumber, 10) : undefined,
    notes: specialInstructions || undefined,
    deliveryAddress: deliveryAddressDto,
    payments: [{ paymentMethod, amount: payableTotal }],
    promoCode: basket?.promoCode || undefined,
    // Pass basket pre-calculated values to ensure consistency
    basketSubTotal: basket?.subTotal,
    basketTax: basket?.tax,
    basketDiscount: basket?.discount,
    basketCustomerDiscount: basket?.customerDiscount,
    basketTotal: payableTotal,
    pointsToRedeem: redeemedPoints,
    tip: tipAmount || 0,
  };
}
