import type {
  GetKitchenBoardWorkOptions,
  KitchenBoardCompletion,
  KitchenBoardCorrection,
  KitchenBoardCursors,
  KitchenBoardOrder,
  KitchenBoardWorkFeed,
} from '@/types/kitchenBoard';

export const KITCHEN_BOARD_PAGE_SIZE = 100;
const MAX_DRAIN_PAGES = 100;

export interface KitchenBoardWorkBatch {
  readonly orders: readonly KitchenBoardOrder[];
  readonly removedOrderIds: readonly string[];
  readonly corrections: readonly KitchenBoardCorrection[];
  readonly removedCorrectionIds: readonly string[];
  readonly completions: readonly KitchenBoardCompletion[];
  readonly cursors: KitchenBoardCursors;
}

type ReadWorkPage = (options: GetKitchenBoardWorkOptions) => Promise<KitchenBoardWorkFeed>;

function requireCursor(cursor: string | null, stream: string): string {
  if (!cursor) throw new Error(`KitchenBoardMissing${stream}Cursor`);
  return cursor;
}

/** Drains all independent snapshots/changes and retains each stream's terminal watermark. */
export async function drainKitchenBoardWorkPages(
  readPage: ReadWorkPage,
  startingCursors: KitchenBoardCursors,
): Promise<KitchenBoardWorkBatch> {
  const orders = new Map<string, KitchenBoardOrder>();
  const removedOrderIds = new Set<string>();
  const corrections = new Map<string, KitchenBoardCorrection>();
  const removedCorrectionIds = new Set<string>();
  const completions: KitchenBoardCompletion[] = [];
  let cursors = startingCursors;

  const applyPage = <T extends { readonly orderId: string }>(
    items: readonly T[],
    removedIds: readonly string[],
    current: Map<string, T>,
    removed: Set<string>,
    getId: (item: T) => string,
  ) => {
    items.forEach((item) => {
      const id = getId(item).toLowerCase();
      if (removed.has(id)) return;
      current.set(id, item);
    });
    removedIds.forEach((rawId) => {
      const id = rawId.toLowerCase();
      current.delete(id);
      removed.add(id);
    });
  };

  for (let pageNumber = 0; pageNumber < MAX_DRAIN_PAGES; pageNumber += 1) {
    const page = await readPage({ ...cursors, pageSize: KITCHEN_BOARD_PAGE_SIZE });
    applyPage(page.orders.items, page.orders.removedIds, orders, removedOrderIds, (item) => item.orderId);
    applyPage(
      page.corrections.items,
      page.corrections.removedIds,
      corrections,
      removedCorrectionIds,
      (item) => item.workItemId,
    );
    completions.push(...page.completions.items);

    cursors = {
      orders: requireCursor(page.orders.nextCursor, 'Orders'),
      corrections: requireCursor(page.corrections.nextCursor, 'Corrections'),
      completions: requireCursor(page.completions.nextCursor, 'Completions'),
    };

    if (!page.orders.hasMore && !page.corrections.hasMore && !page.completions.hasMore) {
      return {
        orders: [...orders.values()],
        removedOrderIds: [...removedOrderIds],
        corrections: [...corrections.values()],
        removedCorrectionIds: [...removedCorrectionIds],
        completions,
        cursors,
      };
    }
  }

  throw new Error('KitchenBoardPageDrainLimit');
}
