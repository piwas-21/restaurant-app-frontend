import type { KitchenBoardCompletion, KitchenBoardCorrection, KitchenBoardOrder } from '@/types/kitchenBoard';
import { initialKitchenBoardState, kitchenBoardReducer } from './kitchenBoardState';

const baseOrder: KitchenBoardOrder = {
  orderId: 'order-a',
  orderNumber: 'A-1',
  type: 'DineIn',
  status: 'Ready',
  tableId: null,
  tableLabel: 'T-4',
  tableNumber: 4,
  serviceSessionId: 'visit-a',
  createdAt: '2026-10-08T12:00:00Z',
  version: 4,
  isCompleted: false,
  completedAt: null,
  canComplete: true,
  requiredKitchenRoutes: [{ target: 'General', status: 'NotConfigured' }],
  items: [],
};

const tombstone: KitchenBoardCorrection = {
  workItemId: 'note-a',
  orderId: 'terminal-order',
  orderNumber: 'A-2',
  status: 'Cancelled',
  tableId: null,
  tableLabel: 'T-4',
  tableNumber: 4,
  serviceSessionId: 'visit-a',
  amendmentId: 'amendment-a',
  accountRevision: 9,
  orderVersion: 12,
  target: null,
  summary: '',
  withdrawn: true,
  isCompleted: true,
  canComplete: false,
  routeStatus: null,
  createdAt: '2026-10-08T12:01:00Z',
  changes: [],
};

const completion: KitchenBoardCompletion = {
  orderId: 'order-a',
  workItemId: 'order-a',
  kind: 'InitialOrder',
  accountRevision: null,
  acknowledgedOrderVersion: 4,
  sequence: 1,
  completedAt: '2026-10-08T12:02:00Z',
};

describe('kitchenBoardReducer', () => {
  it('keeps terminal correction tombstones independent from the operational order page', () => {
    const next = kitchenBoardReducer(initialKitchenBoardState, {
      type: 'feedReceived',
      replace: true,
      batch: {
        orders: [baseOrder],
        removedOrderIds: [],
        corrections: [tombstone],
        removedCorrectionIds: [],
        completions: [],
        cursors: { orders: 'o', corrections: 'c', completions: 'x' },
      },
    });

    expect(next.orders).toEqual([baseOrder]);
    expect(next.corrections).toEqual([tombstone]);
    expect(next.corrections[0].changes).toEqual([]);
    expect(next.corrections[0].canComplete).toBe(false);
  });

  it('projects an immutable completion onto its order without implying a printer receipt', () => {
    const next = kitchenBoardReducer(initialKitchenBoardState, {
      type: 'feedReceived',
      replace: true,
      batch: {
        orders: [baseOrder],
        removedOrderIds: [],
        corrections: [],
        removedCorrectionIds: [],
        completions: [completion],
        cursors: { orders: 'o', corrections: 'c', completions: 'x' },
      },
    });

    expect(next.orders[0]).toMatchObject({ isCompleted: true, completedAt: completion.completedAt });
    expect(next.orders[0].requiredKitchenRoutes[0].status).toBe('NotConfigured');
    expect(next.completions).toEqual([completion]);
  });

  it('does not restore acknowledged cards when removals and a redacted correction tombstone arrive together', () => {
    const activeCorrection = { ...tombstone, withdrawn: false, isCompleted: false, canComplete: true };
    const correctionCompletion: KitchenBoardCompletion = {
      orderId: tombstone.orderId,
      workItemId: tombstone.workItemId,
      kind: 'AmendmentCorrection',
      accountRevision: tombstone.accountRevision,
      acknowledgedOrderVersion: tombstone.orderVersion,
      sequence: 2,
      completedAt: '2026-10-08T12:03:00Z',
    };
    const before = kitchenBoardReducer(initialKitchenBoardState, {
      type: 'feedReceived',
      replace: true,
      batch: {
        orders: [baseOrder],
        removedOrderIds: [],
        corrections: [activeCorrection],
        removedCorrectionIds: [],
        completions: [],
        cursors: { orders: 'o1', corrections: 'c1', completions: 'x1' },
      },
    });

    const after = kitchenBoardReducer(before, {
      type: 'feedReceived',
      replace: false,
      batch: {
        orders: [baseOrder],
        removedOrderIds: [baseOrder.orderId],
        corrections: [tombstone],
        removedCorrectionIds: [activeCorrection.workItemId],
        completions: [completion, correctionCompletion],
        cursors: { orders: 'o2', corrections: 'c2', completions: 'x2' },
      },
    });

    expect(after.orders).toEqual([]);
    expect(after.corrections).toEqual([]);
    expect(after.completions).toEqual([completion, correctionCompletion]);
  });
});
