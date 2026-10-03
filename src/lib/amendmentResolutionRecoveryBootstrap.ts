import { pendingResolutionSchema } from '@/schemas/amendmentResolution.schema';
import { persistPendingAmendmentResolution, readPendingAmendmentResolution } from '@/lib/pendingAmendmentResolution';
import { validatePendingResolution, validateResolutionResult } from '@/lib/amendmentResolutionValidation';
import type { AmendmentResolutionRecovery } from '@/services/amendmentResolutionRecoveryService';
import type { PendingAmendmentResolution } from '@/types/amendmentResolution';

export type AmendmentResolutionRecoveryBootstrap =
  | {
      readonly status: 'pending';
      readonly value: PendingAmendmentResolution;
      readonly result: AmendmentResolutionRecovery['result'];
    }
  | { readonly status: 'unavailable' };

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([first], [second]) => (first < second ? -1 : first > second ? 1 : 0));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function intentWithoutServerOperation(value: PendingAmendmentResolution): PendingAmendmentResolution {
  const intent = { ...value, operationId: null };
  delete intent.pendingTillConfirmations;
  return intent;
}

function sameIntent(first: PendingAmendmentResolution, second: PendingAmendmentResolution): boolean {
  return stableJson(intentWithoutServerOperation(first)) === stableJson(intentWithoutServerOperation(second));
}

/** Restores only a server-accepted operation and preserves any locally frozen physical-refund batch. */
export function restoreAmendmentResolutionRecovery(
  recovery: AmendmentResolutionRecovery,
): AmendmentResolutionRecoveryBootstrap {
  try {
    const serverPending = validatePendingResolution(pendingResolutionSchema.parse(recovery.pending));
    if (serverPending.operationId === null || serverPending.pendingTillConfirmations !== undefined)
      return { status: 'unavailable' };
    const serverResult = validateResolutionResult(recovery.result, serverPending);
    const saved = readPendingAmendmentResolution(
      serverPending.actorId,
      serverPending.orderId,
      serverPending.amendmentId,
    );
    if (saved.status === 'unavailable') return { status: 'unavailable' };

    let restored = serverPending;
    if (saved.status === 'pending') {
      const local = validatePendingResolution(saved.value);
      if (
        (local.operationId !== null && local.operationId !== serverPending.operationId) ||
        !sameIntent(local, serverPending)
      )
        return { status: 'unavailable' };
      restored = validatePendingResolution({
        ...serverPending,
        ...(local.pendingTillConfirmations ? { pendingTillConfirmations: local.pendingTillConfirmations } : {}),
      });
    }

    const result = validateResolutionResult(serverResult, restored);
    if (!persistPendingAmendmentResolution(restored)) return { status: 'unavailable' };
    const readback = readPendingAmendmentResolution(restored.actorId, restored.orderId, restored.amendmentId);
    if (readback.status !== 'pending' || stableJson(readback.value) !== stableJson(restored))
      return { status: 'unavailable' };
    return { status: 'pending', value: readback.value, result };
  } catch (_recoveryError: unknown) {
    return { status: 'unavailable' };
  }
}
