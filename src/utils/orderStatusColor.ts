import { resolveOrderStatus } from '@/lib/orderStatus';

/**
 * Order status → `--status-*` colour token (design-system/tokens/colors.css).
 *
 * Sole consumer is the OrderDetailsActionBar status-dropdown indicator — an empty dot with no text
 * on it, so these hues are safe there. Do NOT use this for anything carrying a label: they are
 * tuned as indicators and five of the six fail WCAG AA as a text background. Badges use the
 * `--badge-status-*-bg` set via a modifier class (`getOrderStatusClass`).
 *
 * Status resolution is delegated so a value the server sends in an unexpected form is normalised
 * the same way here as it is for labels and badges.
 */
const TOKENS: Record<string, string> = {
  Pending: 'var(--status-pending)',
  PendingApproval: 'var(--status-pending)',
  Confirmed: 'var(--status-confirmed)',
  Preparing: 'var(--status-preparing)',
  'In Progress': 'var(--status-preparing)',
  Ready: 'var(--status-ready)',
  OutForDelivery: 'var(--status-confirmed)',
  InTransit: 'var(--status-confirmed)',
  Delivered: 'var(--status-completed)',
  Completed: 'var(--status-completed)',
  Cancelled: 'var(--status-danger)',
  Refunded: 'var(--status-danger)',
};

export function getOrderStatusColor(status: string): string {
  const resolved = resolveOrderStatus(status);
  return (resolved && TOKENS[resolved]) || 'var(--status-completed)';
}
