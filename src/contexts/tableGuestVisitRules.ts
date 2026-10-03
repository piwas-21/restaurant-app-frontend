import { isExpiredVisitError, isUnavailableVisitError } from '@/services/tableGuestVisitService';
import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';

export function recordVisitServiceFailure(
  error: unknown,
  markVisitUnavailable: (reason: 'ended' | 'unavailable') => void,
): void {
  if (isExpiredVisitError(error)) {
    markVisitUnavailable('ended');
  } else if (isUnavailableVisitError(error)) {
    markVisitUnavailable('unavailable');
  }
}

export function isUnexpiredIdentity(identity: TableGuestVisitIdentity): boolean {
  const expiry = new Date(identity.expiresAt).getTime();
  return Number.isFinite(expiry) && expiry > Date.now();
}
