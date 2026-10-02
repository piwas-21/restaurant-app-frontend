import type { OrderAmendmentOperationLookup } from '@/types/orderAmendment';
import { canRequoteUnknownAmendment } from './orderAmendmentOperationState';

describe('canRequoteUnknownAmendment', () => {
  const expiredAt = '2026-10-01T00:00:00Z';
  const now = '2026-10-02T00:00:00Z';

  it('allows a fresh quote only after an expired quote is confirmed unknown', () => {
    expect(canRequoteUnknownAmendment({ status: 'Unknown' } as OrderAmendmentOperationLookup, expiredAt, now)).toBe(
      true,
    );
    expect(canRequoteUnknownAmendment({ status: 'Committed' } as OrderAmendmentOperationLookup, expiredAt, now)).toBe(
      false,
    );
    expect(canRequoteUnknownAmendment(null, expiredAt, now)).toBe(false);
  });

  it('does not discard an operation while its quote can still be retried', () => {
    expect(
      canRequoteUnknownAmendment({ status: 0 } as OrderAmendmentOperationLookup, '2099-01-01T00:00:00Z', now),
    ).toBe(false);
  });

  it('compares expiry instants when the API uses an offset timestamp', () => {
    expect(
      canRequoteUnknownAmendment(
        { status: 'Unknown' } as OrderAmendmentOperationLookup,
        '2026-10-02T00:00:00+02:00',
        '2026-10-01T23:00:00Z',
      ),
    ).toBe(true);
  });
});
