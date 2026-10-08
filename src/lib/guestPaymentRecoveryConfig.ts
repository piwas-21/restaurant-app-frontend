const DEFAULT_ACCOUNT_READ_TIMEOUT_MS = 15_000;
const MAX_ACCOUNT_READ_TIMEOUT_MS = 60_000;
const DEFAULT_RECOVERY_MAX_DURATION_MS = 120_000;
const MAX_RECOVERY_MAX_DURATION_MS = 120_000;
const MAX_POLL_ATTEMPTS = 12;
const MAX_POLL_DELAY_MS = 30_000;
const MAX_POLL_SCHEDULE_MS = 120_000;
const DEFAULT_RETURNED_CHECKOUT_POLL_DELAYS_MS = Object.freeze([2_000, 4_000, 8_000, 16_000, 20_000, 25_000, 30_000]);

interface GuestPaymentRecoveryConfigInput {
  readonly accountReadTimeoutMs?: string;
  readonly recoveryMaxDurationMs?: string;
  readonly returnedCheckoutPollDelaysMs?: string;
}

function boundedPositiveInteger(raw: string | undefined, fallback: number, maximum: number): number {
  const value = (raw ?? '').trim();
  if (!/^\d+$/.test(value)) return fallback;

  const configured = Number(value);
  return Number.isSafeInteger(configured) && configured > 0 && configured <= maximum ? configured : fallback;
}

function boundedPositiveIntegerList(raw: string | undefined): readonly number[] {
  const value = (raw ?? '').trim();
  if (!value) return DEFAULT_RETURNED_CHECKOUT_POLL_DELAYS_MS;

  const entries = value.split(',').map((entry) => entry.trim());
  if (entries.length === 0 || entries.length > MAX_POLL_ATTEMPTS) return DEFAULT_RETURNED_CHECKOUT_POLL_DELAYS_MS;

  const configured: number[] = [];
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) return DEFAULT_RETURNED_CHECKOUT_POLL_DELAYS_MS;
    const delay = Number(entry);
    if (!Number.isSafeInteger(delay) || delay <= 0 || delay > MAX_POLL_DELAY_MS)
      return DEFAULT_RETURNED_CHECKOUT_POLL_DELAYS_MS;
    configured.push(delay);
  }

  const totalDelayMs = configured.reduce((total, delay) => total + delay, 0);
  return totalDelayMs <= MAX_POLL_SCHEDULE_MS ? Object.freeze(configured) : DEFAULT_RETURNED_CHECKOUT_POLL_DELAYS_MS;
}

export function resolveGuestPaymentRecoveryConfig(input: GuestPaymentRecoveryConfigInput) {
  return Object.freeze({
    accountReadTimeoutMs: boundedPositiveInteger(
      input.accountReadTimeoutMs,
      DEFAULT_ACCOUNT_READ_TIMEOUT_MS,
      MAX_ACCOUNT_READ_TIMEOUT_MS,
    ),
    recoveryMaxDurationMs: boundedPositiveInteger(
      input.recoveryMaxDurationMs,
      DEFAULT_RECOVERY_MAX_DURATION_MS,
      MAX_RECOVERY_MAX_DURATION_MS,
    ),
    returnedCheckoutPollDelaysMs: boundedPositiveIntegerList(input.returnedCheckoutPollDelaysMs),
  });
}
