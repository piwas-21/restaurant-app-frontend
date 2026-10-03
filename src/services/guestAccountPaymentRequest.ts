import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';

export function guestPaymentPath(serviceSessionId: string): string {
  return `/api/table-guest-visits/${encodeURIComponent(serviceSessionId)}/account-payments`;
}

export function guestPaymentRequestOptions(headers: Record<string, string>) {
  return { headers, cache: 'no-store' as const, skipAuth: true, skipSession: true, signOutOn401: false };
}

export function participantPaymentRequestOptions(identity: TableGuestVisitIdentity) {
  return guestPaymentRequestOptions({ 'X-Table-Participant': identity.participantToken });
}
