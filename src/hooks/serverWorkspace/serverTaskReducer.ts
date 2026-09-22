import type { ServerServiceTask, ServerTaskFeed } from '@/types/serverTasks';

export interface ServerTaskFeedState {
  readonly items: readonly ServerServiceTask[];
  readonly totalCount: number;
  readonly serverTime: string | null;
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
  readonly isLoading: boolean;
  readonly isStale: boolean;
  readonly error: string | null;
  readonly loaded: boolean;
}

export type ServerTaskFeedAction =
  | { type: 'requestStarted'; reset?: boolean }
  | { type: 'pageReceived'; feed: ServerTaskFeed; replace?: boolean }
  | { type: 'requestFailed'; error: string; stale?: boolean }
  | { type: 'reset' };

export const initialServerTaskFeedState: ServerTaskFeedState = {
  items: [],
  totalCount: 0,
  serverTime: null,
  nextCursor: null,
  hasMore: false,
  isLoading: true,
  isStale: false,
  error: null,
  loaded: false,
};

function bucketRank(bucket: ServerServiceTask['bucket']): number {
  if (bucket === 'Ready') return 0;
  if (bucket === 'Overdue') return 1;
  return 2;
}

function compareTasks(left: ServerServiceTask, right: ServerServiceTask): number {
  const leftBucket = bucketRank(left.bucket);
  const rightBucket = bucketRank(right.bucket);
  if (leftBucket !== rightBucket) return leftBucket - rightBucket;
  const byTime = Date.parse(left.actionableAt) - Date.parse(right.actionableAt);
  if (Number.isFinite(byTime) && byTime !== 0) return byTime;
  return left.orderId.localeCompare(right.orderId);
}

export function reconcileServerTaskFeed(
  previous: readonly ServerServiceTask[],
  feed: ServerTaskFeed,
  replace = false,
): readonly ServerServiceTask[] {
  const byId = new Map<string, ServerServiceTask>();
  if (!replace) previous.forEach((task) => byId.set(task.orderId, task));
  feed.removedOrderIds.forEach((orderId) => byId.delete(orderId));
  feed.items.forEach((task) => byId.set(task.orderId, task));
  return [...byId.values()].sort(compareTasks);
}

export function serverTaskReducer(state: ServerTaskFeedState, action: ServerTaskFeedAction): ServerTaskFeedState {
  switch (action.type) {
    case 'requestStarted':
      return {
        ...state,
        isLoading: true,
        isStale: action.reset ? false : state.loaded,
        error: null,
      };
    case 'pageReceived':
      return {
        ...state,
        items: reconcileServerTaskFeed(state.items, action.feed, action.replace),
        totalCount: action.feed.totalCount,
        serverTime: action.feed.serverTime,
        nextCursor: action.feed.nextCursor ?? null,
        hasMore: action.feed.hasMore,
        isLoading: false,
        isStale: false,
        error: null,
        loaded: true,
      };
    case 'requestFailed':
      return { ...state, isLoading: false, isStale: action.stale ?? state.loaded, error: action.error };
    case 'reset':
      return { ...initialServerTaskFeedState };
    default:
      return state;
  }
}

export function taskBucketCount(states: readonly ServerTaskFeedState[]): number {
  return states.reduce((total, state) => total + state.totalCount, 0);
}
