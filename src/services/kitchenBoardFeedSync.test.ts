import type {
  KitchenBoardCompletion,
  KitchenBoardCorrection,
  KitchenBoardOrder,
  KitchenBoardPage,
  KitchenBoardWorkFeed,
  GetKitchenBoardWorkOptions,
} from '@/types/kitchenBoard';
import { drainKitchenBoardWorkPages } from './kitchenBoardFeedSync';

const order = (orderId: string): KitchenBoardOrder => ({
  orderId,
  orderNumber: orderId,
  type: 'DineIn',
  status: 'Ready',
  tableId: null,
  tableLabel: null,
  tableNumber: null,
  serviceSessionId: null,
  createdAt: '2026-10-08T12:00:00Z',
  version: 1,
  isCompleted: false,
  completedAt: null,
  canComplete: true,
  requiredKitchenRoutes: [],
  items: [],
});

const correction = (workItemId: string): KitchenBoardCorrection => ({
  workItemId,
  orderId: 'order-a',
  orderNumber: 'A-1',
  status: 'Cancelled',
  tableId: null,
  tableLabel: null,
  tableNumber: null,
  serviceSessionId: null,
  amendmentId: 'amendment-a',
  accountRevision: 2,
  orderVersion: 3,
  target: null,
  summary: '',
  withdrawn: true,
  isCompleted: true,
  canComplete: false,
  routeStatus: null,
  createdAt: '2026-10-08T12:00:00Z',
  changes: [],
});

function page<T>(items: readonly T[], cursor: string, hasMore = false, removedIds: string[] = []): KitchenBoardPage<T> {
  return { items, totalCount: items.length, hasMore, removedIds, nextCursor: cursor, watermark: 1, mode: 'Changes' };
}

function feed(
  orders: KitchenBoardPage<KitchenBoardOrder>,
  corrections: KitchenBoardPage<KitchenBoardCorrection>,
  completions: KitchenBoardPage<KitchenBoardCompletion>,
): KitchenBoardWorkFeed {
  return { orders, corrections, completions };
}

describe('drainKitchenBoardWorkPages', () => {
  it('carries all independent cursors while draining and retains terminal watermarks', async () => {
    const calls: unknown[] = [];
    const readPage = jest.fn(async (options: GetKitchenBoardWorkOptions) => {
      calls.push(options);
      if (calls.length === 1) {
        return feed(page([order('order-a')], 'orders-2', true), page([], 'corrections-1'), page([], 'completions-1'));
      }
      if (calls.length === 2) {
        return feed(
          page([], 'orders-3'),
          page([correction('correction-a')], 'corrections-2', true),
          page([], 'completions-1'),
        );
      }
      return feed(page([], 'orders-3'), page([], 'corrections-2'), page([], 'completions-4'));
    });

    const batch = await drainKitchenBoardWorkPages(readPage, {
      orders: null,
      corrections: null,
      completions: null,
    });

    expect(calls).toEqual([
      { orders: null, corrections: null, completions: null, pageSize: 100 },
      { orders: 'orders-2', corrections: 'corrections-1', completions: 'completions-1', pageSize: 100 },
      { orders: 'orders-3', corrections: 'corrections-2', completions: 'completions-1', pageSize: 100 },
    ]);
    expect(batch).toMatchObject({
      orders: [order('order-a')],
      corrections: [correction('correction-a')],
      removedOrderIds: [],
      removedCorrectionIds: [],
      cursors: { orders: 'orders-3', corrections: 'corrections-2', completions: 'completions-4' },
    });
  });

  it('keeps removals authoritative across later pages that repeat a stale work item', async () => {
    const activeCorrection = { ...correction('note-a'), withdrawn: false, isCompleted: false, canComplete: true };
    let call = 0;
    const readPage = async () => {
      call += 1;
      if (call === 1) {
        return feed(
          page([order('order-a')], 'orders-2', true),
          page([activeCorrection], 'corrections-1', true),
          page([], 'completions-1', true),
        );
      }
      if (call === 2) {
        return feed(
          page([], 'orders-3', true, ['order-a']),
          page([correction('note-a')], 'corrections-2', true, ['note-a']),
          page([], 'completions-2', true),
        );
      }
      return feed(
        page([order('order-a')], 'orders-4'),
        page([activeCorrection], 'corrections-3'),
        page([], 'completions-3'),
      );
    };

    const batch = await drainKitchenBoardWorkPages(readPage, {
      orders: null,
      corrections: null,
      completions: null,
    });

    expect(batch.orders).toEqual([]);
    expect(batch.removedOrderIds).toEqual(['order-a']);
    expect(batch.corrections).toEqual([]);
    expect(batch.removedCorrectionIds).toEqual(['note-a']);
  });

  it('fails closed when a stream omits its terminal cursor', async () => {
    const readPage = async () =>
      feed(page([], 'orders-1'), page([], 'corrections-1'), {
        ...page<KitchenBoardCompletion>([], 'completions-1'),
        nextCursor: null,
      });
    await expect(
      drainKitchenBoardWorkPages(readPage, { orders: null, corrections: null, completions: null }),
    ).rejects.toThrow('KitchenBoardMissingCompletionsCursor');
  });
});
