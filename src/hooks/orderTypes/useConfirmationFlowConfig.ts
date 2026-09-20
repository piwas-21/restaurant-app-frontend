'use client';

// The per-order-type confirmation flow (order confirmation flows, backend S1). One shared read of
// the PUBLIC configuration endpoint: the cashier modal needs the flow for its wording (approve vs
// confirm) and the guest screen needs the flow + review window for its progress state. Anonymous
// by contract, so it works on both a staff and a guest surface.
import { useEffect, useState } from 'react';
import {
  orderTypeConfigurationService,
  type ConfirmationFlow,
  type OrderTypeConfirmationPublicDto,
} from '@/services/orderTypeConfigurationService';
import type { OrderType } from '@/types/order';

export interface ConfirmationFlowConfig {
  flow: ConfirmationFlow;
  reviewWindowMinutes: number;
}

export type ConfirmationFlowLookup = (orderType: string) => ConfirmationFlowConfig | null;

interface UseConfirmationFlowConfigResult {
  /** True until the first read settles (either way). While true the flow is simply unknown. */
  isLoading: boolean;
  /** null = the config is unavailable; callers fall back to direct-flow behaviour. */
  flowByType: Map<string, ConfirmationFlowConfig> | null;
}

const DEFAULT_REVIEW_WINDOW_MINUTES = 2;

function isFlow(value: string): value is ConfirmationFlow {
  return value === 'direct' || value === 'acknowledge';
}

/** The row for one order type: an unparseable flow reads as direct, a missing window as the default. */
function toConfig(row: OrderTypeConfirmationPublicDto): ConfirmationFlowConfig {
  return {
    flow: isFlow(row.confirmationFlow) ? row.confirmationFlow : 'direct',
    reviewWindowMinutes:
      Number.isFinite(row.reviewWindowMinutes) && row.reviewWindowMinutes > 0
        ? row.reviewWindowMinutes
        : DEFAULT_REVIEW_WINDOW_MINUTES,
  };
}

export function useConfirmationFlowConfig(): UseConfirmationFlowConfigResult {
  const [state, setState] = useState<UseConfirmationFlowConfigResult>({ isLoading: true, flowByType: null });
  useEffect(() => {
    let cancelled = false;
    orderTypeConfigurationService
      .getPublicConfirmationConfigurations()
      .then((rows) => {
        if (cancelled) return;
        const map = new Map<string, ConfirmationFlowConfig>();
        rows.forEach((row) => map.set(row.orderType, toConfig(row)));
        setState({ isLoading: false, flowByType: map });
      })
      .catch((error: unknown) => {
        // The guest screen renders today's static behaviour when the window is unknown; log the
        // failure for operators because the customer cannot act on it.
        console.warn('Failed to load public order confirmation flow configuration', error);
        if (!cancelled) setState({ isLoading: false, flowByType: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** Pure selector so components (and tests) share ONE unknown-type answer: null. */
export function flowLookup(flowByType: Map<string, ConfirmationFlowConfig> | null): ConfirmationFlowLookup {
  return (orderType: string) => flowByType?.get(orderType as OrderType) ?? null;
}
