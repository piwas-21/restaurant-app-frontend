'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useOptionalAuth } from '@/components/AuthContext';
import { ApiError, getErrorMessage } from '@/utils/apiClient';
import { addOrderBillCharges } from '@/services/billChargeService';
import type { OrderDto } from '@/types/order';
import type { BillChargeInput } from '@/types/billCharge';

const pendingSchema = z.object({
  orderId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
  operationId: z.string().uuid(),
  charges: z
    .array(z.object({ key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/), amount: z.number().positive().max(10000) }))
    .min(1)
    .max(12),
});
type Pending = z.infer<typeof pendingSchema>;

export function useOrderBillChargeAction(
  order: OrderDto,
  disabled: boolean,
  onUpdated: () => void | Promise<void>,
  onBusyChange?: (busy: boolean) => void,
) {
  const auth = useOptionalAuth();
  const actorId = auth?.user?.userId;
  const key = actorId ? `staff.bill-charge:${actorId}:${order.id}` : null;
  const [values, setValues] = useState<BillChargeInput[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(false);
    if (!key) return;
    try {
      const raw = sessionStorage.getItem(key);
      const stored = raw ? pendingSchema.parse(JSON.parse(raw)) : null;
      if (stored && stored.orderId !== order.id) throw new Error('Charge recovery identity mismatch');
      setPending(stored);
      setValues(stored?.charges ?? []);
      setStorageBlocked(false);
    } catch (error: unknown) {
      // Browser storage failures use the dedicated recovery message and keep financial actions locked.
      void error;
      setStorageBlocked(true);
    }
    setHydrated(true);
  }, [key, order.id]);
  useEffect(() => {
    onBusyChange?.(busy || pending !== null || storageBlocked);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange, pending, storageBlocked]);
  const save = async () => {
    if (busy || (disabled && !pending) || !key || !hydrated || storageBlocked) return;
    const request = pending ?? {
      orderId: order.id,
      expectedVersion: order.version ?? 0,
      operationId: crypto.randomUUID(),
      charges: values.filter((value) => value.amount > 0),
    };
    if (!pendingSchema.safeParse(request).success) {
      setFailed(true);
      return;
    }
    try {
      sessionStorage.setItem(key, JSON.stringify(request));
    } catch (error: unknown) {
      // Browser storage failures use the dedicated recovery message and keep financial actions locked.
      void error;
      setStorageBlocked(true);
      return;
    }
    setPending(request);
    setBusy(true);
    setFailed(false);
    setMessage(null);
    try {
      await addOrderBillCharges(request.orderId, request.expectedVersion, request.operationId, request.charges);
      sessionStorage.removeItem(key);
      setPending(null);
      setValues([]);
      await onUpdated();
    } catch (error: unknown) {
      setMessage(getErrorMessage(error));
      setFailed(true);
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        try {
          sessionStorage.removeItem(key);
          setPending(null);
        } catch (error: unknown) {
          // Browser storage failures use the dedicated recovery message and keep financial actions locked.
          void error;
          setStorageBlocked(true);
        }
        await onUpdated();
      }
    } finally {
      setBusy(false);
    }
  };
  return { values, setValues, busy, failed, message, pending, storageBlocked, hydrated, save };
}
