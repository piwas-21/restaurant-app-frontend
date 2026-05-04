import type { UserDto } from '@/types/user';
import { updateProfile } from '@/services/userService';

/**
 * Fire-and-forget phone-persist call (BUGS-IMPROVEMENTS-PLAN §C1.5.h).
 * When a logged-in customer fills in a previously-missing phone field
 * inside one of the order-type modals, push the new value to
 * /api/User/profile so the next order skips the modal entirely.
 *
 * No-ops when the user is a guest, the user object is unresolved, or
 * the phone hasn't changed. Failure is non-blocking — the order
 * continues regardless.
 */
export function persistPhoneToProfileIfChanged(opts: {
  isLoggedIn: boolean;
  user: UserDto | null;
  newPhone: string;
}): void {
  const { isLoggedIn, user, newPhone } = opts;
  if (!isLoggedIn || !user || !newPhone) return;
  if (newPhone === (user.phoneNumber ?? '')) return;

  updateProfile({
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: newPhone,
  }).catch((err) => {
    console.warn('Profile phone-persist failed (non-blocking):', err);
  });
}
