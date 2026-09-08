'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TableBillDto } from '@/types/order';
import { addTableBillPayment, getTableBill, AddPaymentRequest } from '@/services/cashierService';
import { getErrorMessage } from '@/utils/apiClient';
import { tableNumberSchema } from '@/schemas/tableBill.schema';

/**
 * State + actions for the one-bill-per-table dialog: fetch the bill for a table
 * number (only once the caller commits a number, not per keystroke), take one
 * tender against the whole bill, and refresh afterwards. Page logic lives here
 * (CLAUDE.md §5 rule 1); the dialog only renders.
 *
 * THE TENDER TARGETS `bill.tableNumber`, never the live input: the bill on
 * screen is what the cashier settles, so edits to the input that were not
 * followed by "Load bill" cannot redirect the tender to another table.
 */
export function useTableBill() {
  const { t } = useTranslation();
  const [tableNumberInput, setTableNumberInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [bill, setBill] = useState<TableBillDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const isMountedRef = useRef(true);
  // Request sequencing: only the newest load may write state, so a slow OLDER
  // response cannot leave a bill on screen for a table other than the input.
  const loadSequenceRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // User input is validated through the zod schema (CLAUDE.md §5 rule: forms via zod);
  // the hook owns the parse so the dialog only renders.
  const parsedTable = tableNumberSchema.safeParse(tableNumberInput);
  const hasValidTable = parsedTable.success;
  const tableNumber = parsedTable.success ? parsedTable.data : null;

  const fetchBill = useCallback(
    async (table: number): Promise<boolean> => {
      if (!isMountedRef.current) return false;
      const requestId = ++loadSequenceRef.current;
      setIsLoading(true);
      setError(null);
      try {
        const result = await getTableBill(table);
        if (!isMountedRef.current || requestId !== loadSequenceRef.current) return false;
        setBill(result);
        return true;
      } catch (err) {
        if (!isMountedRef.current || requestId !== loadSequenceRef.current) return false;
        setBill(null);
        setError(getErrorMessage(err) ?? t('cashier.table_bill.error.loading'));
        return false;
      } finally {
        if (isMountedRef.current && requestId === loadSequenceRef.current) {
          setIsLoading(false);
        }
      }
    },
    [t],
  );

  const loadBill = useCallback(() => {
    const parsed = tableNumberSchema.safeParse(tableNumberInput);
    if (parsed.success) {
      void fetchBill(parsed.data);
    }
  }, [fetchBill, tableNumberInput]);

  const payBill = useCallback(
    async (paymentData: AddPaymentRequest): Promise<boolean> => {
      if (!bill) return false;
      if (!isMountedRef.current) return false;
      setIsPaying(true);
      setError(null);
      try {
        // The bill ON SCREEN is the tender's target — not the (possibly edited) input.
        const updated = await addTableBillPayment(bill.tableNumber, paymentData);
        if (!isMountedRef.current) return false;
        setBill(updated);
        return true;
      } catch (err) {
        if (!isMountedRef.current) return false;
        setError(getErrorMessage(err) ?? t('cashier.table_bill.error.payment'));
        return false;
      } finally {
        if (isMountedRef.current) {
          setIsPaying(false);
        }
      }
    },
    [bill, t],
  );

  const reset = useCallback(() => {
    setTableNumberInput('');
    setBill(null);
    setError(null);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setTableNumberInput('');
    setBill(null);
    setError(null);
  }, []);

  return {
    isOpen,
    open,
    close,
    tableNumberInput,
    setTableNumberInput,
    tableNumber: hasValidTable ? tableNumber : null,
    hasValidTable,
    bill,
    isLoading,
    isPaying,
    error,
    loadBill,
    payBill,
    reset,
  };
}
