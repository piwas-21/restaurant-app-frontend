'use client';

import { createContext, useContext } from 'react';
import { hasStoredTableGuestState } from '@/services/tableGuestVisitStorage';
import type { TableGuestFeatureStatus } from '@/contexts/TableGuestFeatureContext';
import type {
  TableGuestAccountDto,
  PendingTableGuestRound,
  TableGuestRoundAcknowledgement,
  TableGuestRoundRequest,
  TableGuestVisitIdentity,
  TableGuestVisitPhase,
} from '@/types/tableGuestVisit';

export interface TableGuestVisitContextValue {
  readonly phase: TableGuestVisitPhase;
  readonly visit: TableGuestVisitIdentity | null;
  readonly featureEnabled: boolean;
  readonly featureStatus: TableGuestFeatureStatus;
  readonly pendingRound: PendingTableGuestRound | null;
  readonly pendingRoundStatus: 'known' | 'unknown';
  readonly requiresSafeDeparture: boolean;
  readonly lastRoundAcknowledgement: TableGuestRoundAcknowledgement | null;
  readonly joinVisit: (qrCodeData: string, admissionCode: string, tableId: string) => Promise<TableGuestVisitIdentity>;
  readonly getAccount: () => Promise<TableGuestAccountDto>;
  readonly createRound: (request: TableGuestRoundRequest) => Promise<TableGuestAccountDto>;
  readonly savePendingRound: (attempt: PendingTableGuestRound) => boolean;
  readonly clearPendingRound: () => void;
  readonly markVisitUnavailable: (reason?: 'ended' | 'unavailable') => void;
  readonly leaveAfterSafeDeparture: () => boolean;
  readonly recordRoundAcknowledgement: () => void;
}

const noVisitError = () => Promise.reject(new Error('No table visit is active.'));
const NO_VISIT_CONTEXT: TableGuestVisitContextValue = {
  phase: 'notJoined',
  visit: null,
  featureEnabled: false,
  featureStatus: 'idle',
  pendingRound: null,
  pendingRoundStatus: 'known',
  requiresSafeDeparture: false,
  lastRoundAcknowledgement: null,
  joinVisit: noVisitError,
  getAccount: noVisitError,
  createRound: noVisitError,
  savePendingRound: () => false,
  clearPendingRound: () => undefined,
  markVisitUnavailable: () => undefined,
  leaveAfterSafeDeparture: () => false,
  recordRoundAcknowledgement: () => undefined,
};

const SAVED_VISIT_LOADING_CONTEXT: TableGuestVisitContextValue = {
  ...NO_VISIT_CONTEXT,
  phase: 'loading',
};

export const TableGuestVisitContext = createContext<TableGuestVisitContextValue | null>(null);

/** A stored visit blocks ordinary dine-in checkout until its provider has recovered it. */
export function useTableGuestVisit(): TableGuestVisitContextValue {
  const context = useContext(TableGuestVisitContext);
  return context ?? (hasStoredTableGuestState() ? SAVED_VISIT_LOADING_CONTEXT : NO_VISIT_CONTEXT);
}
