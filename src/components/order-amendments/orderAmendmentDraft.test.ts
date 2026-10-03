import type { OrderDto } from '@/types/order';
import type { OrderAmendmentDraft } from '@/hooks/orderAmendments/orderAmendmentTypes';
import { serverSourceChangesReadOnly, sourceLineRange, updateOrderAmendmentChange } from './orderAmendmentDraft';

const draft: OrderAmendmentDraft = {
  additions: [],
  changes: [],
  reason: '',
  preparingOverrideAcknowledged: false,
  releaseAdditionsToKitchen: true,
  localProviderSupplementConsent: false,
  providerConsentNote: '',
};

describe('order amendment draft helpers', () => {
  it('keeps one-based unit ranges pinned to the selected root line identity', () => {
    const sourceLine = { id: 'root-42', quantity: 4 } as OrderDto['items'][number];
    const range = sourceLineRange(sourceLine, { 'root-42': { startOrdinal: 3, quantity: 2 } });
    const updated = updateOrderAmendmentChange(draft, sourceLine.id, {
      orderItemId: sourceLine.id,
      kind: 'Void',
      ...range,
    });

    expect(updated.changes).toEqual([{ orderItemId: 'root-42', kind: 'Void', startOrdinal: 3, quantity: 2 }]);
  });

  it('keeps server source correction read-only after service while allowing supplements separately', () => {
    expect(serverSourceChangesReadOnly({ status: 'Delivered' } as OrderDto)).toBe(true);
    expect(serverSourceChangesReadOnly({ status: 'Preparing' } as OrderDto)).toBe(false);
  });
});
