/** Route metadata for the read-only cashier workspace increment.
 *
 * Collection remains at `/cashier`; these destinations deliberately have no links to
 * mutation surfaces until their server contracts land.
 */
export type CashierWorkspaceDestination = 'orders' | 'history';

export interface CashierWorkspaceRoute {
  readonly destination: CashierWorkspaceDestination;
  readonly href: `/cashier/${CashierWorkspaceDestination}`;
  readonly labelKey: string;
  readonly descriptionKey: string;
}

export const CASHIER_WORKSPACE_ROUTES: readonly CashierWorkspaceRoute[] = [
  {
    destination: 'orders',
    href: '/cashier/orders',
    labelKey: 'cashier.workspace.orders',
    descriptionKey: 'cashier.workspace.orders_description',
  },
  {
    destination: 'history',
    href: '/cashier/history',
    labelKey: 'cashier.workspace.history',
    descriptionKey: 'cashier.workspace.history_description',
  },
];

export function isCashierWorkspacePath(pathname: string): boolean {
  return CASHIER_WORKSPACE_ROUTES.some(({ href }) => pathname === href || pathname.startsWith(`${href}/`));
}
