'use client';

import { useCallback, useEffect, useRef } from 'react';
import { completeKitchenBoardWork } from '@/services/kitchenBoardService';
import { updateOrderStatus } from '@/services/order/orderCommands';
import { routeApiError } from '@/utils/apiFormErrors';
import type { KitchenBoardAction, KitchenBoardState } from './kitchenBoardState';

type Dispatch = (action: KitchenBoardAction) => void;
type Synchronize = (replace?: boolean) => Promise<void>;

function isReadyForAction(state: KitchenBoardState): boolean {
  return state.loaded && !state.isLoading && !state.loadFailed && !state.isStale && state.busyActionKey === null;
}

function sameId(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export function useKitchenBoardActions(
  enabled: boolean,
  state: KitchenBoardState,
  dispatch: Dispatch,
  refresh: () => Promise<void>,
  synchronize: Synchronize,
) {
  const stateRef = useRef(state);
  const enabledRef = useRef(enabled);
  const mountedRef = useRef(false);
  const locksRef = useRef(new Set<string>());
  stateRef.current = state;
  enabledRef.current = enabled;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runAction = useCallback(
    async (key: string, operation: () => Promise<void>) => {
      if (!enabledRef.current || !isReadyForAction(stateRef.current) || locksRef.current.size > 0) return;
      locksRef.current.add(key);
      dispatch({ type: 'actionStarted', key });
      try {
        await operation();
        if (mountedRef.current) dispatch({ type: 'actionFinished' });
      } catch (reason: unknown) {
        routeApiError(reason);
        await refresh();
        if (mountedRef.current) dispatch({ type: 'actionFailed' });
      } finally {
        locksRef.current.delete(key);
      }
    },
    [dispatch, refresh],
  );

  const setOrderStatus = useCallback(
    async (orderId: string, nextStatus: 'Preparing' | 'Ready') => {
      const order = stateRef.current.orders.find((item) => sameId(item.orderId, orderId));
      const allowed =
        order &&
        ((order.status === 'Confirmed' && nextStatus === 'Preparing') ||
          (order.status === 'Preparing' && nextStatus === 'Ready'));
      if (!allowed || !order) return;
      await runAction(`order:${order.orderId}`, async () => {
        const updated = await updateOrderStatus(order.orderId, {
          newStatus: nextStatus,
          expectedVersion: order.version,
        });
        if (!sameId(updated.id, order.orderId) || updated.status !== nextStatus || updated.version <= order.version) {
          throw new Error('KitchenBoardOrderStatusMismatch');
        }
        await refresh();
      });
    },
    [refresh, runAction],
  );

  const completeInitialOrder = useCallback(
    async (orderId: string) => {
      const order = stateRef.current.orders.find((item) => sameId(item.orderId, orderId));
      if (order?.status !== 'Ready' || !order.canComplete || order.isCompleted) return;
      await runAction(`order:${order.orderId}`, async () => {
        const result = await completeKitchenBoardWork(order.orderId, order.orderId, {
          kind: 'InitialOrder',
          expectedOrderVersion: order.version,
          expectedAccountRevision: null,
        });
        if (mountedRef.current) dispatch({ type: 'completionReceived', completion: result });
        await synchronize(false);
      });
    },
    [dispatch, runAction, synchronize],
  );

  const completeCorrection = useCallback(
    async (workItemId: string) => {
      const correction = stateRef.current.corrections.find((item) => sameId(item.workItemId, workItemId));
      if (
        !correction ||
        correction.withdrawn ||
        correction.isCompleted ||
        !correction.canComplete ||
        !Number.isSafeInteger(correction.accountRevision) ||
        !correction.accountRevision ||
        !Number.isSafeInteger(correction.orderVersion) ||
        correction.orderVersion <= 0
      ) {
        return;
      }
      await runAction(`correction:${correction.workItemId}`, async () => {
        const result = await completeKitchenBoardWork(correction.orderId, correction.workItemId, {
          kind: 'AmendmentCorrection',
          expectedOrderVersion: correction.orderVersion,
          expectedAccountRevision: correction.accountRevision,
        });
        if (mountedRef.current) dispatch({ type: 'completionReceived', completion: result });
        await synchronize(false);
      });
    },
    [dispatch, runAction, synchronize],
  );

  return { setOrderStatus, completeInitialOrder, completeCorrection };
}
