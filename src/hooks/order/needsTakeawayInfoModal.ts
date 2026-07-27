import { getCurrentUser } from '@/services/userService';

function isLoggedInClient(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('auth_token');
}

/**
 * Does picking Takeaway need the contact modal?
 *
 * Fast-pathed off CheckoutContext first — if `customerInfo` is already there from a prior modal in
 * this session, no API call. Only when context is empty do we hit `/api/User/profile` to decide;
 * failure falls through to "open the modal", which is the safe default because the modal asks for
 * everything anyway.
 *
 * Extracted from `useOrderTypeFollowUp` (it is a pure async predicate, not hook state) when that
 * hook took on the two-phase conflict switch and reached its §4 LOC budget.
 */
export async function needsTakeawayInfoModal(
  existingCustomerInfo: { name: string; email: string; phone: string } | null,
): Promise<boolean> {
  if (existingCustomerInfo?.name && existingCustomerInfo?.email && existingCustomerInfo?.phone) {
    return false;
  }
  if (!isLoggedInClient()) return true;
  try {
    const user = await getCurrentUser();
    const complete = !!(
      user.firstName?.trim() &&
      user.lastName?.trim() &&
      user.email?.trim() &&
      user.phoneNumber?.trim()
    );
    return !complete;
  } catch (err) {
    console.warn('Profile fetch failed deciding takeaway modal; opening modal:', err);
    return true;
  }
}
