/** Route metadata for the route-backed cashier workspace destinations. */
export type CashierWorkspaceDestination = 'orders' | 'history' | 'tables';

export const CASHIER_ORDERS_PATH = '/cashier/orders' as const;
/** Focused tender route. It is not a navigation destination because it needs an order target. */
export const CASHIER_COLLECTION_PATH = '/cashier/collection' as const;
export const CASHIER_TABLES_PATH = '/cashier/tables' as const;

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
