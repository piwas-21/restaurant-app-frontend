import type { GuestAccountPaymentAttemptDescriptor } from '@/types/guestAccountPayments';
import { webcrypto } from 'node:crypto';
import { TextEncoder as NodeTextEncoder } from 'node:util';
import { fingerprintGuestParticipant } from '@/lib/guestParticipantFingerprint';
import {
  createGuestAccountPaymentDescriptor,
  createReceiptCredential,
  hasGuestAccountPaymentRecovery,
  readGuestAccountPaymentAttempts,
  saveGuestAccountPaymentAttempt,
  withReceiptExpiry,
  withReservation,
} from './guestAccountPaymentStorage';

const STORAGE_KEY = 'rumi_table_guest_payment_attempts_v1';
const SESSION_ID = '00000000-0000-4000-8000-000000000001';
const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
const originalTextEncoder = Object.getOwnPropertyDescriptor(globalThis, 'TextEncoder');

function operationId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

function attempt(index: number): GuestAccountPaymentAttemptDescriptor {
  return createGuestAccountPaymentDescriptor(
    SESSION_ID,
    operationId(index),
    {
      expectedAccountRevision: 7,
      mode: 'Amount',
      paymentMethod: 'OnlinePayment',
      amountMinor: 1250,
    },
    'a'.repeat(64),
  );
}

describe('guest account payment attempt storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
    Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: NodeTextEncoder });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
    else Reflect.deleteProperty(globalThis, 'crypto');
    if (originalTextEncoder) Object.defineProperty(globalThis, 'TextEncoder', originalTextEncoder);
    else Reflect.deleteProperty(globalThis, 'TextEncoder');
  });

  it('stores only bounded operation evidence in sessionStorage and keeps the receipt key canonical', () => {
    const credential = createReceiptCredential();
    if (!credential) throw new Error('secure random source is unavailable in the test environment');
    expect(credential).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(saveGuestAccountPaymentAttempt(withReservation(attempt(1), 8, credential))).toBe(true);

    const raw = sessionStorage.getItem(STORAGE_KEY) ?? '';
    expect(JSON.parse(raw)).toMatchObject({
      version: 1,
      attempts: [{ serviceSessionId: SESSION_ID, operationId: operationId(1), receiptCredential: credential }],
    });
    expect(raw).not.toContain('participantToken');
    expect(raw).not.toContain('guest name');
    expect(localStorage.length).toBe(0);
  });

  it('stores a one-way participant fingerprint without retaining the participant credential', async () => {
    const rawParticipantCredential = 'private-participant-credential';
    const fingerprint = await fingerprintGuestParticipant(rawParticipantCredential);
    if (!fingerprint) throw new Error('secure fingerprint source is unavailable in the test environment');
    const descriptor = createGuestAccountPaymentDescriptor(
      SESSION_ID,
      operationId(2),
      {
        expectedAccountRevision: 7,
        mode: 'Amount',
        paymentMethod: 'OnlinePayment',
        amountMinor: 1250,
      },
      fingerprint,
    );

    expect(saveGuestAccountPaymentAttempt(descriptor)).toBe(true);
    const raw = sessionStorage.getItem(STORAGE_KEY) ?? '';
    expect(raw).toContain(fingerprint);
    expect(raw).not.toContain(rawParticipantCredential);
    expect(raw).not.toContain('participantToken');
  });

  it('keeps unresolved operations after elapsed time and reports full storage instead of evicting evidence', () => {
    const first = withReceiptExpiry(attempt(1), '2020-01-01T00:00:00.000Z', 'Processing');
    for (let index = 1; index <= 16; index += 1) {
      expect(saveGuestAccountPaymentAttempt(index === 1 ? first : attempt(index))).toBe(true);
    }
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 365 * 24 * 60 * 60 * 1000);

    expect(saveGuestAccountPaymentAttempt(attempt(17))).toBe(false);
    const saved = readGuestAccountPaymentAttempts();
    if (saved.kind !== 'ready') throw new Error('expected stored attempts to remain readable');
    expect(saved.attempts).toHaveLength(16);
    expect(saved.attempts[0]).toMatchObject({ operationId: operationId(1), quotedVersion: null });
    jest.restoreAllMocks();
  });

  it('prunes only a terminal receipt with an expired server-supplied expiry', () => {
    const expired = withReceiptExpiry(attempt(1), '2020-01-01T00:00:00.000Z', 'Captured');
    expect(saveGuestAccountPaymentAttempt(expired)).toBe(true);
    for (let index = 2; index <= 16; index += 1) expect(saveGuestAccountPaymentAttempt(attempt(index))).toBe(true);

    expect(saveGuestAccountPaymentAttempt(attempt(17))).toBe(true);
    const saved = readGuestAccountPaymentAttempts();
    if (saved.kind !== 'ready') throw new Error('expected stored attempts to remain readable');
    expect(saved.attempts).toHaveLength(16);
    expect(saved.attempts.some((value) => value.operationId === operationId(1))).toBe(false);
    expect(saved.attempts.some((value) => value.operationId === operationId(17))).toBe(true);
  });

  it('treats only confirmed expired terminal receipts as no longer recoverable', () => {
    expect(saveGuestAccountPaymentAttempt(withReceiptExpiry(attempt(1), '2020-01-01T00:00:00.000Z', 'Captured'))).toBe(
      true,
    );
    expect(hasGuestAccountPaymentRecovery()).toBe(false);

    expect(
      saveGuestAccountPaymentAttempt(withReceiptExpiry(attempt(2), '2020-01-01T00:00:00.000Z', 'Processing')),
    ).toBe(true);
    expect(hasGuestAccountPaymentRecovery()).toBe(true);
  });

  it('keeps reconciliation-held terminal-looking receipts after their expiry', () => {
    const held = withReceiptExpiry(attempt(1), '2020-01-01T00:00:00.000Z', 'Captured', true);
    expect(held.receiptTerminalState).toBeNull();
    expect(saveGuestAccountPaymentAttempt(held)).toBe(true);
    for (let index = 2; index <= 16; index += 1) expect(saveGuestAccountPaymentAttempt(attempt(index))).toBe(true);

    expect(saveGuestAccountPaymentAttempt(attempt(17))).toBe(false);
    const saved = readGuestAccountPaymentAttempts();
    if (saved.kind !== 'ready') throw new Error('expected reconciliation evidence to remain readable');
    expect(saved.attempts[0]).toMatchObject({ operationId: operationId(1), receiptTerminalState: null });
    expect(hasGuestAccountPaymentRecovery()).toBe(true);
  });

  it('rejects unexpected PII/free-text keys instead of persisting them', () => {
    const unsafe = { ...attempt(1), guestName: 'guest name' } as GuestAccountPaymentAttemptDescriptor;
    expect(saveGuestAccountPaymentAttempt(unsafe)).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
