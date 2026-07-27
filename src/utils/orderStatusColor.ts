/**
 * Maps an order status to its CSS-variable colour token (the `--status-*` set in
 * design-system/tokens/colors.css). Extracted verbatim from OrderDetails.getStatusColor
 * (Sprint 4/6 god-file decomposition).
 *
 * Sole consumer is the OrderDetailsActionBar status-dropdown indicator — an empty dot with no
 * text on it, so the `--status-*` hues are safe there. Do NOT use this for anything that carries
 * a label: these hues are tuned as indicators and five of the six fail WCAG AA as a text
 * background. Badges use the `--badge-status-*-bg` set instead (see design-system/tokens/
 * colors.css), applied via a modifier class — OrderDetails and OrderList both do this.
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
