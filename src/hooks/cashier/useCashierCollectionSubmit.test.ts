import { act, renderHook } from '@testing-library/react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { CashierCollectionPaymentOutcome } from './useCashierCollectionForm.types';
import type { OrderDto } from '@/types/order';
import { PaymentMethod } from '@/types/order';
import type { AddPaymentRequest } from '@/services/cashierService';
import { useCashierCollectionSubmit } from './useCashierCollectionSubmit';

const order = {
  id: 'order-1',
  orderNumber: '1042',
  total: 19.75,
  totalPaid: 0,
  remainingAmount: 19.75,
  isFullyPaid: false,
  status: 'Completed',
  paymentStatus: 'Pending',
  currency: 'CHF',
  version: 3,
  items: [],
  payments: [],
  statusHistory: [],
} as unknown as OrderDto;

const setString: Dispatch<SetStateAction<string>> = () => undefined;
const setError: Dispatch<SetStateAction<string | null>> = () => undefined;
const setOutcome: Dispatch<SetStateAction<CashierCollectionPaymentOutcome | null>> = () => undefined;

describe('useCashierCollectionSubmit', () => {
  it('passes reviewed cash received separately from the order-payment request', async () => {
    const onSubmit = jest.fn(async (_payment: AddPaymentRequest, _cashReceivedMinor?: number) => ({
      ...order,
      totalPaid: 19.75,
      remainingAmount: 0,
      isFullyPaid: true,
    }));
    const { result } = renderHook(() =>
      useCashierCollectionSubmit({
        order,
        controlsDisabled: false,
        amount: '19.75',
        tip: '0.00',
        tipValid: true,
        method: PaymentMethod.Cash,
        received: '20.00',
        transactionId: '',
        notes: '',
        onSubmit,
        operationFor: () => 'operation-1',
        resetOperation: jest.fn(),
        t: (key) => key,
        locale: 'en',
        setAmount: setString,
        setTip: setString,
        setReceived: setString,
        setMethod: setString,
        setTransactionId: setString,
        setNotes: setString,
        setError,
        setLastPayment: setOutcome,
      }),
    );
    const event = { preventDefault: jest.fn() } as unknown as FormEvent<HTMLFormElement>;

    await act(async () => result.current(event));

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'operation-1',
        expectedVersion: 3,
        paymentMethod: 'Cash',
        amount: 19.75,
      }),
      2000,
    );
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('cashReceivedMinor');
  });
});
