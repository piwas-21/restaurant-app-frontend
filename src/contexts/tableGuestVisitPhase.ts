import type { TableGuestFeatureStatus } from '@/contexts/TableGuestFeatureContext';
import type { StoredTableGuestState } from '@/services/tableGuestVisitStorage';
import type { TableGuestVisitPhase } from '@/types/tableGuestVisit';

export function resolveTableGuestVisitPhase(
  isHydrated: boolean,
  stored: StoredTableGuestState,
  featureStatus: TableGuestFeatureStatus,
  featureEnabled: boolean,
  visitUnavailable: boolean,
): TableGuestVisitPhase {
  if (!isHydrated) return 'loading';
  if (stored.kind === 'storageUnavailable') return 'storageUnavailable';
  if (stored.kind === 'corrupt') return 'storageUnavailable';
  if (stored.kind === 'blocked') return stored.reason;
  if (stored.kind === 'visit') {
    if (featureStatus === 'idle' || featureStatus === 'loading') return 'loading';
    if (featureStatus === 'unavailable') return 'unavailable';
    // A rollout switch does not prove that a saved visit or lost-response round ended.
    if (!featureEnabled || visitUnavailable) return 'unavailable';
    return 'active';
  }
  return featureStatus === 'idle' || featureStatus === 'loading' ? 'loading' : 'notJoined';
}
