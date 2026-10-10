'use client';

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { readPendingTableOccupancyRecovery } from '@/lib/pendingTableOccupancyRecovery';
import type { PendingTableOccupancyRecovery } from '@/types/tableOccupancyRecovery';
import type { RecoveryState } from './useTableOccupancyRecovery.types';

interface Input {
  readonly actorId: string;
  readonly actorRole: PendingTableOccupancyRecovery['actorRole'];
  readonly tableId: string;
  readonly serviceSessionId?: string;
  readonly pending: MutableRefObject<PendingTableOccupancyRecovery | null>;
  readonly generation: MutableRefObject<number>;
  readonly inFlight: MutableRefObject<boolean>;
  readonly mounted: MutableRefObject<boolean>;
  readonly setState: Dispatch<SetStateAction<RecoveryState>>;
  readonly readback: (saved: PendingTableOccupancyRecovery) => Promise<void>;
}

export function useRestoreTableOccupancyRecovery({
  actorId,
  actorRole,
  tableId,
  serviceSessionId,
  pending,
  generation,
  inFlight,
  mounted,
  setState,
  readback,
}: Input): void {
  useEffect(() => {
    mounted.current = true;
    const saved = readPendingTableOccupancyRecovery(actorId, tableId, actorRole);
    if (saved.status === 'none') {
      pending.current = null;
      setState({ stage: 'idle' });
    } else if (saved.status === 'role_mismatch') {
      pending.current = null;
      setState({ stage: 'unavailable', error: 'role_mismatch' });
    } else if (saved.status === 'unavailable') {
      pending.current = null;
      setState({ stage: 'unavailable', error: 'storage_unavailable' });
    } else {
      pending.current = saved.value;
      setState({ stage: 'pending' });
      void readback(saved.value);
    }
    return () => {
      mounted.current = false;
      generation.current += 1;
      inFlight.current = false;
    };
  }, [actorId, actorRole, generation, inFlight, mounted, pending, readback, serviceSessionId, setState, tableId]);
}
