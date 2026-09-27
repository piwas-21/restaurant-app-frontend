import type { OptionSetMaterializationRequest, OptionSetTargetRequest } from '@/types/optionSetMaterialization';
import type { OptionSetMaterializationTarget } from './optionSetMaterialization';

export function createOptionSetIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function toOptionSetTargetRequest(
  target: OptionSetMaterializationTarget,
  entryIds: readonly string[],
): OptionSetTargetRequest | null {
  if (!target.targetProductId || !target.targetKey || !entryIds.length) return null;
  if (target.role === 'bundleChoice' && (!target.contextId || target.expectedMenuAuthoringVersion === undefined)) {
    return null;
  }
  if (
    target.role === 'productChoice' &&
    (!target.contextId || target.expectedCustomizationGroupVersion === undefined)
  ) {
    return null;
  }
  const reason = target.intentionalDifferenceReason.trim();
  return {
    targetKey: target.targetKey,
    role: target.role,
    targetProductId: target.targetProductId,
    ...(target.role === 'bundleChoice' && target.contextId ? { targetMenuSectionId: target.contextId } : {}),
    ...(target.role === 'productChoice' && target.contextId ? { targetCustomizationGroupId: target.contextId } : {}),
    ...(target.expectedMenuAuthoringVersion !== undefined
      ? { expectedMenuAuthoringVersion: target.expectedMenuAuthoringVersion }
      : {}),
    ...(target.expectedCustomizationGroupVersion !== undefined
      ? { expectedCustomizationGroupVersion: target.expectedCustomizationGroupVersion }
      : {}),
    expectedAttachmentVersion: target.expectedAttachmentVersion,
    entryIds,
    conflictPolicy: target.conflictPolicy,
    ...(Object.keys(target.settings).length ? { settings: target.settings } : {}),
    ...(Object.keys(target.overrides).length ? { overrides: target.overrides } : {}),
    ...(reason ? { intentionalDifferenceReason: reason } : {}),
  };
}

export function makeOptionSetMaterializationRequest(
  version: number,
  idempotencyKey: string,
  targets: readonly OptionSetMaterializationTarget[],
  entryIds: readonly string[],
): OptionSetMaterializationRequest | null {
  const requests = targets
    .filter((target) => target.selected)
    .map((target) => toOptionSetTargetRequest(target, entryIds));
  if (!requests.length || requests.some((request) => request === null)) return null;
  return {
    expectedSetVersion: version,
    idempotencyKey,
    targets: requests as OptionSetTargetRequest[],
  };
}

export function addDifferenceReasons(
  request: OptionSetMaterializationRequest,
  targets: readonly OptionSetMaterializationTarget[],
): OptionSetMaterializationRequest {
  const reasons = new Map(targets.map((target) => [target.targetKey, target.intentionalDifferenceReason.trim()]));
  return {
    ...request,
    targets: request.targets.map((target) => {
      const reason = reasons.get(target.targetKey);
      return reason ? { ...target, intentionalDifferenceReason: reason } : target;
    }),
  };
}
