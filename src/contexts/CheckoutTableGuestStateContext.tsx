'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { TableGuestVisitPhase } from '@/types/tableGuestVisit';

export interface CheckoutTableGuestState {
  readonly phase: TableGuestVisitPhase;
  readonly hasPendingRound: boolean;
  readonly hasAcknowledgement: boolean;
}

const DEFAULT_CHECKOUT_TABLE_GUEST_STATE: CheckoutTableGuestState = {
  phase: 'loading',
  hasPendingRound: false,
  hasAcknowledgement: false,
};

export const CheckoutTableGuestStateContext = createContext<CheckoutTableGuestState>(
  DEFAULT_CHECKOUT_TABLE_GUEST_STATE,
);

export function CheckoutTableGuestStateProvider({
  value,
  children,
}: Readonly<{ value: CheckoutTableGuestState; children: ReactNode }>) {
  return <CheckoutTableGuestStateContext.Provider value={value}>{children}</CheckoutTableGuestStateContext.Provider>;
}

export function useCheckoutTableGuestState(): CheckoutTableGuestState {
  return useContext(CheckoutTableGuestStateContext);
}
