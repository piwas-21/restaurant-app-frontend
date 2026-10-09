'use client';

import { useKitchenBoardActions } from './useKitchenBoardActions';
import { useKitchenBoardFeed } from './useKitchenBoardFeed';

/** Composes the separately testable feed and explicit staff-action hooks. */
export function useKitchenBoardWork(enabled: boolean) {
  const feed = useKitchenBoardFeed(enabled);
  const actions = useKitchenBoardActions(enabled, feed.state, feed.dispatch, feed.refresh, feed.synchronize);
  return { ...feed, ...actions };
}
