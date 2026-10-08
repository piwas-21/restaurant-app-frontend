import type {
  CompleteKitchenBoardWorkResult,
  KitchenBoardCompletion,
  KitchenBoardCorrection,
  KitchenBoardOrder,
} from '@/types/kitchenBoard';
import type { KitchenBoardWorkBatch } from '@/services/kitchenBoardFeedSync';

export interface KitchenBoardState {
  readonly orders: readonly KitchenBoardOrder[];
  readonly corrections: readonly KitchenBoardCorrection[];
  readonly completions: readonly KitchenBoardCompletion[];
  readonly isLoading: boolean;
  readonly loaded: boolean;
  readonly isStale: boolean;
  readonly loadFailed: boolean;
  readonly actionFailed: boolean;
  readonly busyActionKey: string | null;
}

export type KitchenBoardAction =
  | { readonly type: 'requestStarted' }
  | { readonly type: 'feedReceived'; readonly batch: KitchenBoardWorkBatch; readonly replace: boolean }
  | { readonly type: 'requestFailed' }
  | { readonly type: 'completionReceived'; readonly completion: CompleteKitchenBoardWorkResult }
  | { readonly type: 'actionStarted'; readonly key: string }
  | { readonly type: 'actionFinished' }
  | { readonly type: 'actionFailed' }
  | { readonly type: 'actionErrorCleared' }
  | { readonly type: 'reset' };

export const initialKitchenBoardState: KitchenBoardState = {
  orders: [],
  corrections: [],
  completions: [],
  isLoading: false,
  loaded: false,
  isStale: false,
  loadFailed: false,
  actionFailed: false,
  busyActionKey: null,
};

function mergeById<T>(
  previous: readonly T[],
  incoming: readonly T[],
  removedIds: readonly string[],
  getId: (item: T) => string,
  replace: boolean,
): T[] {
  const items = new Map<string, T>();
  if (!replace) previous.forEach((item) => items.set(getId(item).toLowerCase(), item));
  incoming.forEach((item) => items.set(getId(item).toLowerCase(), item));
  removedIds.forEach((id) => items.delete(id.toLowerCase()));
  return [...items.values()];
}

function completionKey(completion: KitchenBoardCompletion): string {
  return `${completion.orderId.toLowerCase()}:${completion.workItemId.toLowerCase()}:${completion.kind}`;
}

function applyCompletions(
  orders: readonly KitchenBoardOrder[],
  corrections: readonly KitchenBoardCorrection[],
  completions: readonly KitchenBoardCompletion[],
) {
  const byKey = new Map(completions.map((completion) => [completionKey(completion), completion]));
  return {
    orders: orders.map((order) => {
      const completion = byKey.get(`${order.orderId.toLowerCase()}:${order.orderId.toLowerCase()}:InitialOrder`);
      return completion ? { ...order, isCompleted: true, completedAt: completion.completedAt } : order;
    }),
    corrections: corrections.map((correction) => {
      const completion = byKey.get(
        `${correction.orderId.toLowerCase()}:${correction.workItemId.toLowerCase()}:AmendmentCorrection`,
      );
      return completion ? { ...correction, isCompleted: true } : correction;
    }),
  };
}

export function kitchenBoardReducer(state: KitchenBoardState, action: KitchenBoardAction): KitchenBoardState {
  switch (action.type) {
    case 'requestStarted':
      return { ...state, isLoading: true, loadFailed: false };
    case 'feedReceived': {
      const orders = mergeById(
        state.orders,
        action.batch.orders,
        action.batch.removedOrderIds,
        (item) => item.orderId,
        action.replace,
      );
      const corrections = mergeById(
        state.corrections,
        action.batch.corrections,
        action.batch.removedCorrectionIds,
        (item) => item.workItemId,
        action.replace,
      );
      const completions = mergeById(state.completions, action.batch.completions, [], completionKey, action.replace);
      const projected = applyCompletions(orders, corrections, completions);
      return {
        ...state,
        ...projected,
        completions,
        isLoading: false,
        loaded: true,
        isStale: false,
        loadFailed: false,
      };
    }
    case 'requestFailed':
      return { ...state, isLoading: false, isStale: state.loaded, loadFailed: true };
    case 'completionReceived': {
      const completions = mergeById(state.completions, [action.completion], [], completionKey, false);
      const projected = applyCompletions(state.orders, state.corrections, completions);
      return { ...state, ...projected, completions };
    }
    case 'actionStarted':
      return { ...state, busyActionKey: action.key, actionFailed: false };
    case 'actionFinished':
      return { ...state, busyActionKey: null };
    case 'actionFailed':
      return { ...state, busyActionKey: null, actionFailed: true };
    case 'actionErrorCleared':
      return { ...state, actionFailed: false };
    case 'reset':
      return initialKitchenBoardState;
    default:
      return state;
  }
}
