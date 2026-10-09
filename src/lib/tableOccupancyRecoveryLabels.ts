import type { RecoveryError } from '@/hooks/tableReadiness/useTableOccupancyRecovery.types';
import type { TableOccupancyRecoveryDisposition } from '@/types/tableOccupancyRecovery';

export const recoveryErrorTranslationKeys: Record<RecoveryError, string> = {
  preview_failed: 'accountPayments.recovery.preview_failed',
  operation_mismatch: 'accountPayments.recovery.operation_mismatch',
  reason_required: 'accountPayments.recovery.reason_required',
  version_missing: 'accountPayments.recovery.version_missing',
  stale_preview: 'accountPayments.recovery.stale_preview',
  session_ambiguous: 'accountPayments.recovery.session_ambiguous',
  role_mismatch: 'accountPayments.recovery.role_mismatch',
  storage_unavailable: 'accountPayments.recovery.storage_unavailable',
};

export const recoveryDispositionTranslationKeys: Record<TableOccupancyRecoveryDisposition, string> = {
  CancelledUnsent: 'accountPayments.recovery.disposition.CancelledUnsent',
  ArchivedLegacyOccupancy: 'accountPayments.recovery.disposition.ArchivedLegacyOccupancy',
  RetainedInPriorVisit: 'accountPayments.recovery.disposition.RetainedInPriorVisit',
};

export function recoveryErrorTranslationKey(error: RecoveryError | undefined, fallback: RecoveryError): string {
  return recoveryErrorTranslationKeys[error ?? fallback];
}

export function recoveryDispositionTranslationKey(disposition: TableOccupancyRecoveryDisposition): string {
  return recoveryDispositionTranslationKeys[disposition];
}
