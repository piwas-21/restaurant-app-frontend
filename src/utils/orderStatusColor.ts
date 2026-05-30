/**
 * Maps an order status to its CSS-variable colour token (defined in globals.css). Used by the
 * cashier OrderDetails header badge and status-dropdown indicator. Extracted verbatim from
 * OrderDetails.getStatusColor (Sprint 4/6 god-file decomposition).
 */
export function getOrderStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'pending':
      return 'var(--status-pending)';
    case 'confirmed':
      return 'var(--status-confirmed)';
    case 'preparing':
      return 'var(--status-preparing)';
    case 'ready':
      return 'var(--status-ready)';
    case 'completed':
      return 'var(--status-completed)';
    case 'cancelled':
      return 'var(--status-danger)';
    default:
      return 'var(--status-completed)';
  }
}
