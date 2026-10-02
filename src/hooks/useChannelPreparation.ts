'use client';

import { useEffect, useRef, useState } from 'react';
import type { OrderDto, OrderStatus } from '@/types/order';
import { permitsChannelLocalAction } from '@/lib/externalOrder';
import { updateOrderStatus } from '@/services/order/orderCommands';
import { ApiError, getErrorMessage } from '@/utils/apiClient';

/** Preparation is local only after provider confirmation; no optimistic status or provider completion. */
export function useChannelPreparation(order: OrderDto, onOrderChanged?: () => void) {
  const mounted = useRef(true);
  const active = useRef(order.id);
  const generation = useRef(0);
  const inFlight = useRef(new Set<string>());
  const [busy, setBusy] = useState<{ id: string; generation: number } | null>(null);
  const [completed, setCompleted] = useState<{ id: string; version: number } | null>(null);
  const [failure, setFailure] = useState<{ id: string; generation: number; error: unknown } | null>(null);
  if (active.current !== order.id) {
    active.current = order.id;
    generation.current += 1;
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const allowed =
    order.externalOrder?.provider === 'uber-eats' &&
    order.externalOrder.externalState === 'ACCEPTED' &&
    order.externalOrder.fulfillmentType === 'DELIVERY_BY_UBER' &&
    order.isKitchenReleased;
  let target: OrderStatus | null = null;
  if (allowed && order.status === 'Confirmed' && permitsChannelLocalAction(order, 'StartPreparing'))
    target = 'Preparing';
  if (allowed && order.status === 'Preparing' && permitsChannelLocalAction(order, 'MarkReady')) target = 'Ready';
  const pending =
    (busy?.id === order.id && busy.generation === generation.current) ||
    (completed?.id === order.id && completed.version === order.version);
  const advance = async () => {
    if (!target || pending || inFlight.current.has(order.id)) return;
    const id = order.id;
    const version = order.version;
    const current = generation.current;
    inFlight.current.add(id);
    setBusy({ id, generation: current });
    setFailure(null);
    const isCurrent = () => mounted.current && active.current === id && generation.current === current;
    try {
      const updated = await updateOrderStatus(id, { newStatus: target, expectedVersion: version });
      if (!isCurrent()) return;
      if (
        updated.id !== id ||
        updated.status !== target ||
        !Number.isInteger(updated.version) ||
        updated.version <= version
      )
        throw new ApiError(502, '');
      setCompleted({ id, version });
      onOrderChanged?.();
    } catch (error: unknown) {
      if (isCurrent()) {
        setFailure({ id, generation: current, error });
        onOrderChanged?.();
      }
    } finally {
      inFlight.current.delete(id);
      if (mounted.current)
        setBusy((previous) => (previous?.id === id && previous.generation === current ? null : previous));
    }
  };
  return {
    target,
    advance,
    pending,
    error:
      failure?.id === order.id && failure.generation === generation.current ? getErrorMessage(failure.error) : null,
    failed: failure?.id === order.id && failure.generation === generation.current,
  };
}
