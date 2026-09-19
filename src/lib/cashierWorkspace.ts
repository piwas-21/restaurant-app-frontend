/** Route metadata for the route-backed cashier workspace destinations. */
export type CashierWorkspaceDestination = 'orders' | 'new' | 'history' | 'tables';

export const CASHIER_ORDERS_PATH = '/cashier/orders' as const;
/** Counter-sale destination: catalog on the left, persistent ticket on the right. */
export const CASHIER_NEW_SALE_PATH = '/cashier/new' as const;
/** Focused tender route. It is not a navigation destination because it needs an order target. */
export const CASHIER_COLLECTION_PATH = '/cashier/collection' as const;
export const CASHIER_TABLES_PATH = '/cashier/tables' as const;
/** Existing waiter/staff order route; it creates legacy table orders until membership is shipped. */
export const STAFF_ORDER_PATH = '/server' as const;

export function staffTableOrderHref(
  tableNumber: string | number | null | undefined,
  serviceSessionId?: string,
): string {
  const params = new URLSearchParams();
  // A label-only visit has no number to hand over; the session id still identifies the visit.
  if (tableNumber !== null && tableNumber !== undefined && String(tableNumber).trim() !== '') {
    params.set('tableNumber', String(tableNumber));
  }
  if (serviceSessionId) params.set('serviceSessionId', serviceSessionId);
  const query = params.toString();
  return query === '' ? STAFF_ORDER_PATH : `${STAFF_ORDER_PATH}?${query}`;
}

export interface CashierWorkspaceRoute {
  readonly destination: CashierWorkspaceDestination;
  readonly href: `/cashier/${CashierWorkspaceDestination}`;
  readonly labelKey: string;
  readonly descriptionKey: string;
}

export const CASHIER_WORKSPACE_ROUTES: readonly CashierWorkspaceRoute[] = [
  {
    destination: 'orders',
    href: CASHIER_ORDERS_PATH,
    labelKey: 'cashier.workspace.orders',
    descriptionKey: 'cashier.workspace.orders_description',
  },
  {
    destination: 'new',
    href: CASHIER_NEW_SALE_PATH,
    labelKey: 'cashier.workspace.new_sale',
    descriptionKey: 'cashier.workspace.new_sale_description',
  },
  {
    destination: 'history',
    href: '/cashier/history',
    labelKey: 'cashier.workspace.history',
    descriptionKey: 'cashier.workspace.history_description',
  },
  {
    destination: 'tables',
    href: CASHIER_TABLES_PATH,
    labelKey: 'cashier.workspace.tables',
    descriptionKey: 'cashier.workspace.tables_description',
  },
];

export function isCashierWorkspacePath(pathname: string): boolean {
  return (
    CASHIER_WORKSPACE_ROUTES.some(({ href }) => pathname === href || pathname.startsWith(`${href}/`)) ||
    pathname === CASHIER_COLLECTION_PATH ||
    pathname.startsWith(`${CASHIER_COLLECTION_PATH}/`) ||
    pathname === CASHIER_TABLES_PATH ||
    pathname.startsWith(`${CASHIER_TABLES_PATH}/`)
  );
}
