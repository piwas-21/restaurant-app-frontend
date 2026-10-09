export const GUEST_PAYMENT_RECOVERY_CHANGED = 'rumi:guest-payment-recovery-changed';

export function notifyGuestPaymentRecoveryChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(GUEST_PAYMENT_RECOVERY_CHANGED));
  }
}
