import type { OrderAmendmentCommitRequest } from '@/types/orderAmendment';
import {
  clearPendingAmendmentCommit,
  persistPendingAmendmentCommit,
  readPendingAmendmentCommit,
} from './pendingAmendmentCommit';

const actorId = 'actor-1';
const sourceOrderId = 'order-1';
const operationId = '2c844989-5e41-4a94-977b-2a2db27cb38b';
const request: OrderAmendmentCommitRequest = {
  amendmentId: 'amendment-1',
  clientOperationId: operationId,
  expectedOrderVersion: 8,
  expectedAccountRevision: 17,
  reviewAcknowledged: true,
};

describe('pending amendment commit recovery storage', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('persists only operation identity, versions, acknowledgement, and expiry in this tab', () => {
    expect(
      persistPendingAmendmentCommit({
        actorId,
        sourceOrderId,
        request,
        expiresAt: '2099-01-01T00:00:00.000Z',
      }),
    ).toBe(true);

    const stored = window.sessionStorage.getItem('rumi.pending-order-amendment.v1:actor-1:order-1');
    expect(stored).toContain(operationId);
    expect(stored).not.toMatch(/reason|instruction|customer|email|phone/i);
    expect(readPendingAmendmentCommit(actorId, sourceOrderId)).toEqual({
      status: 'pending',
      value: {
        actorId,
        sourceOrderId,
        request,
        expiresAt: '2099-01-01T00:00:00.000Z',
      },
    });
  });

  it('fails closed for corrupt or identity-mismatched records', () => {
    window.sessionStorage.setItem('rumi.pending-order-amendment.v1:actor-1:order-1', '');
    expect(readPendingAmendmentCommit(actorId, sourceOrderId)).toEqual({ status: 'unavailable' });
    expect(clearPendingAmendmentCommit(actorId, sourceOrderId, operationId)).toBe(false);
    window.sessionStorage.setItem('rumi.pending-order-amendment.v1:actor-1:order-1', '{bad');
    expect(readPendingAmendmentCommit(actorId, sourceOrderId)).toEqual({ status: 'unavailable' });

    expect(
      persistPendingAmendmentCommit({
        actorId,
        sourceOrderId,
        request,
        expiresAt: '2099-01-01T00:00:00.000Z',
      }),
    ).toBe(false);
    window.sessionStorage.removeItem('rumi.pending-order-amendment.v1:actor-1:order-1');
    expect(
      persistPendingAmendmentCommit({ actorId, sourceOrderId, request, expiresAt: '2099-01-01T00:00:00.000Z' }),
    ).toBe(true);
    expect(readPendingAmendmentCommit('actor-2', sourceOrderId)).toEqual({ status: 'none' });
  });

  it('refuses replacing an escaped operation or changing its reviewed versions', () => {
    const value = { actorId, sourceOrderId, request, expiresAt: '2099-01-01T00:00:00.000Z' };
    expect(persistPendingAmendmentCommit(value)).toBe(true);
    expect(
      persistPendingAmendmentCommit({
        ...value,
        request: { ...request, clientOperationId: '4a3ce94e-7a31-4c5e-a129-0fbe033c38e3' },
      }),
    ).toBe(false);
    expect(persistPendingAmendmentCommit({ ...value, request: { ...request, expectedOrderVersion: 9 } })).toBe(false);
    expect(readPendingAmendmentCommit(actorId, sourceOrderId)).toEqual({ status: 'pending', value });
  });

  it('clears only the matching operation key', () => {
    persistPendingAmendmentCommit({
      actorId,
      sourceOrderId,
      request,
      expiresAt: '2099-01-01T00:00:00.000Z',
    });

    expect(clearPendingAmendmentCommit(actorId, sourceOrderId, 'another-operation')).toBe(false);
    expect(readPendingAmendmentCommit(actorId, sourceOrderId).status).toBe('pending');
    expect(clearPendingAmendmentCommit(actorId, sourceOrderId, operationId)).toBe(true);
    expect(readPendingAmendmentCommit(actorId, sourceOrderId)).toEqual({ status: 'none' });
  });
});
