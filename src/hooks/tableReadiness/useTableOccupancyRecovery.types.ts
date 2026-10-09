import type {
  PendingTableOccupancyRecovery,
  TableOccupancyRecoveryOperation,
  TableOccupancyRecoveryPreview,
} from '@/types/tableOccupancyRecovery';

export type RecoveryStage =
  'checking' | 'idle' | 'previewing' | 'previewed' | 'working' | 'pending' | 'settled' | 'unavailable' | 'failed';
export type RecoveryError =
  | 'preview_failed'
  | 'operation_mismatch'
  | 'reason_required'
  | 'version_missing'
  | 'stale_preview'
  | 'session_ambiguous'
  | 'role_mismatch'
  | 'storage_unavailable';

export interface RecoveryState {
  readonly stage: RecoveryStage;
  readonly preview?: TableOccupancyRecoveryPreview;
  readonly operation?: TableOccupancyRecoveryOperation;
  readonly currency?: string | null;
  readonly error?: RecoveryError;
}

export interface UseTableOccupancyRecoveryInput {
  readonly actorId: string;
  readonly actorRole: PendingTableOccupancyRecovery['actorRole'];
  readonly tableId: string;
  readonly serviceSessionId?: string;
  readonly canWrite: boolean;
  readonly onRecovered: () => Promise<void>;
}
