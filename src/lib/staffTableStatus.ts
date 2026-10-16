import type { StatusBadgeTone } from '@/components/design-system/StatusBadge';

/** Cashier and Server names for the same operational state share one visual meaning. */
export function staffTableStatusTone(state: string): StatusBadgeTone {
  switch (state.toLowerCase()) {
    case 'available':
    case 'ready':
      return 'success';
    case 'open':
    case 'occupied':
      return 'info';
    case 'reserved':
    case 'needsreset':
    case 'needs-reset':
      return 'warning';
    case 'ambiguous':
    case 'legacy':
    case 'conflict':
      return 'danger';
    default:
      return 'neutral';
  }
}
