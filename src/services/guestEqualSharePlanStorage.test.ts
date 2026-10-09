import { TextEncoder as NodeTextEncoder } from 'node:util';
import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import {
  createGuestEqualSharePlanIntent,
  findGuestEqualSharePlanIntent,
  hasGuestEqualSharePlanRecovery,
  readGuestEqualSharePlanIntents,
  removeGuestEqualSharePlanIntent,
  saveGuestEqualSharePlanIntent,
} from './guestEqualSharePlanStorage';
import { hasGuestAccountPaymentRecovery } from './guestAccountPaymentStorage';

const STORAGE_KEY = 'rumi_table_guest_payment_plans_v1';
const SESSION_ID = '00000000-0000-4000-8000-000000000001';
const OPERATION_ID = '00000000-0000-4000-8000-000000000010';
const identity: TableGuestVisitIdentity = {
  serviceSessionId: SESSION_ID,
  participantToken: 'participant-secret',
  expiresAt: '2030-01-01T00:00:00Z',
};
const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
const originalTextEncoder = Object.getOwnPropertyDescriptor(globalThis, 'TextEncoder');

function encodedFingerprint(fill: number): ArrayBuffer {
  return new Uint8Array(32).fill(fill).buffer;
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: NodeTextEncoder });
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      subtle: {
        digest: jest.fn(async (_algorithm: AlgorithmIdentifier, data: BufferSource) => {
          const token = String.fromCharCode(...(data as unknown as Uint8Array));
          return encodedFingerprint(token === identity.participantToken ? 0 : 1);
        }),
      },
    } as unknown as Crypto,
  });
});

afterEach(() => {
  if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
  else Reflect.deleteProperty(globalThis, 'crypto');
  if (originalTextEncoder) Object.defineProperty(globalThis, 'TextEncoder', originalTextEncoder);
  else Reflect.deleteProperty(globalThis, 'TextEncoder');
});

describe('guest equal-share plan recovery storage', () => {
  it('persists a bounded operation descriptor without the participant credential and wakes the payment host', async () => {
    const intent = await createGuestEqualSharePlanIntent(identity, OPERATION_ID, 7, 2, null);
    expect(intent).not.toBeNull();
    if (!intent) throw new Error('expected a secure participant fingerprint');
    expect(saveGuestEqualSharePlanIntent(intent)).toBe(true);

    const raw = sessionStorage.getItem(STORAGE_KEY) ?? '';
    expect(JSON.parse(raw)).toMatchObject({
      version: 1,
      intents: [
        {
          serviceSessionId: SESSION_ID,
          participantFingerprint: '0'.repeat(64),
          operationId: OPERATION_ID,
          expectedAccountRevision: 7,
          shareCount: 2,
          supersedesPlanId: null,
        },
      ],
    });
    expect(raw).not.toContain(identity.participantToken);
    expect(hasGuestEqualSharePlanRecovery()).toBe(true);
    expect(hasGuestAccountPaymentRecovery()).toBe(true);
  });

  it('matches only the same participant and keeps an unresolved intent until explicit confirmation', async () => {
    const intent = await createGuestEqualSharePlanIntent(identity, OPERATION_ID, 7, 2, null);
    if (!intent) throw new Error('expected a secure participant fingerprint');
    expect(saveGuestEqualSharePlanIntent(intent)).toBe(true);

    expect(await findGuestEqualSharePlanIntent(identity)).toEqual({ kind: 'intent', intent });
    expect(await findGuestEqualSharePlanIntent({ ...identity, participantToken: 'different-participant' })).toEqual({
      kind: 'none',
    });
    expect(readGuestEqualSharePlanIntents()).toEqual({ kind: 'ready', intents: [intent] });
    expect(removeGuestEqualSharePlanIntent(intent)).toBe(true);
    expect(readGuestEqualSharePlanIntents()).toEqual({ kind: 'empty' });
  });

  it('fails closed on corrupted or inaccessible records instead of treating them as absent', () => {
    sessionStorage.setItem(STORAGE_KEY, '{');
    expect(readGuestEqualSharePlanIntents()).toEqual({ kind: 'unavailable' });
    expect(hasGuestEqualSharePlanRecovery()).toBe(true);
    expect(hasGuestAccountPaymentRecovery()).toBe(true);
  });
});
