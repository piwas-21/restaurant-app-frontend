export interface DisplayOrderNumberSource {
  readonly dailyOrderNumber?: number | null;
  readonly orderNumber?: string | null;
}

/** Use the short business-day sequence in staff/guest conversations; keep full IDs for lookup. */
export function getOrderDisplayNumber(order: DisplayOrderNumberSource): string {
  if (
    typeof order.dailyOrderNumber === 'number' &&
    Number.isSafeInteger(order.dailyOrderNumber) &&
    order.dailyOrderNumber > 0
  ) {
    return String(order.dailyOrderNumber);
  }
  return order.orderNumber?.trim() ?? '';
}
