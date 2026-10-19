import { CASHIER_PRINT_STATUS_POLL_MS } from '@/config/printing';
import { ApiError, getErrorMessage } from '@/utils/apiClient';
import { useEffect, useRef, useState } from 'react';
import {
  getCashierPrintJob,
  queueCashierBill,
  type CashierPrintJob,
  type CashierPrintTarget,
} from '@/services/cashierPrintingService';

export function useCashierBillPrint(target: CashierPrintTarget, open: boolean) {
  const [job, setJob] = useState<CashierPrintJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const operation = useRef<{ identity: string; id: string } | null>(null);
  const identity = JSON.stringify({ orderId: target.orderId, serviceSessionId: target.serviceSessionId });
  useEffect(() => {
    setJob(null);
    setFailed(false);
    setError(null);
  }, [identity]);
  useEffect(() => {
    if (!open || !job || !['Queued', 'Claimed'].includes(job.status)) return;
    let active = true;
    const timer = setInterval(() => {
      void getCashierPrintJob(job.jobId)
        .then((updated) => {
          if (active) {
            setJob(updated);
            setFailed(false);
            setError(null);
          }
        })
        .catch((reason: unknown) => {
          if (active) {
            setFailed(true);
            setError(reason instanceof ApiError ? getErrorMessage(reason) : null);
          }
        });
    }, CASHIER_PRINT_STATUS_POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [open, job]);
  const send = async (anotherCopy = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailed(false);
    if (anotherCopy || operation.current?.identity !== identity)
      operation.current = { identity, id: crypto.randomUUID() };
    try {
      setJob(await queueCashierBill(target, operation.current.id));
    } catch (reason: unknown) {
      setFailed(true);
      setError(reason instanceof ApiError ? getErrorMessage(reason) : null);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return { job, busy, failed, error, send };
}
