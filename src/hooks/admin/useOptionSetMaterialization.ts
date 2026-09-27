'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { applyOptionSetAttachments, previewOptionSetAttachments } from '@/services/optionSetService';
import { getOptionSetTargetProducts } from '@/services/optionSetTargetService';
import type { OptionSetDetail } from '@/types/optionSet';
import type { OptionSetMaterializationPreview, OptionSetMaterializationResult } from '@/types/optionSetMaterialization';
import { getErrorMessage } from '@/utils/apiClient';
import {
  targetsForProduct,
  targetsFromAttachments,
  type OptionSetMaterializationTarget,
} from '@/utils/optionSetMaterialization';
import {
  addDifferenceReasons,
  createOptionSetIdempotencyKey,
  makeOptionSetMaterializationRequest,
} from '@/utils/optionSetMaterializationRequest';
import { useOptionSetMaterializationFeature } from './useOptionSetMaterializationFeature';

export function useOptionSetMaterialization(detail: OptionSetDetail, isDirty: boolean, onApplied: () => void) {
  const feature = useOptionSetMaterializationFeature();
  const [targets, setTargets] = useState<OptionSetMaterializationTarget[]>([]);
  const [targetErrors, setTargetErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<OptionSetMaterializationPreview | null>(null);
  const [previewRequest, setPreviewRequest] = useState<ReturnType<typeof makeOptionSetMaterializationRequest>>(null);
  const [result, setResult] = useState<OptionSetMaterializationResult | null>(null);
  const [isLoadingTargets, setIsLoadingTargets] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [targetReloadKey, setTargetReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const entryIds = useMemo(() => detail.entries.flatMap((entry) => (entry.id ? [entry.id] : [])), [detail.entries]);
  const allEntriesPersisted = entryIds.length === detail.entries.length;

  useEffect(() => {
    let current = true;
    setIsLoadingTargets(true);
    setPreview(null);
    setPreviewRequest(null);
    setResult(null);
    void getOptionSetTargetProducts(detail.attachments.map((attachment) => attachment.targetProductId)).then(
      ({ loaded, failed }) => {
        if (!current) return;
        setTargets(targetsFromAttachments(detail.attachments, loaded));
        setTargetErrors(failed);
        setIsLoadingTargets(false);
      },
    );
    return () => {
      current = false;
    };
  }, [detail.attachments, detail.id, detail.version, targetReloadKey]);

  const invalidatePreview = useCallback(() => {
    setPreview(null);
    setPreviewRequest(null);
    setResult(null);
    setError(null);
  }, []);

  const addProduct = useCallback(
    (product: Parameters<typeof targetsForProduct>[0]) => {
      const additions = targetsForProduct(product, detail.kind).filter(
        (target) => !targets.some((current) => current.targetKey === target.targetKey),
      );
      if (!additions.length) return false;
      setTargets((current) => [...current, ...additions]);
      invalidatePreview();
      return true;
    },
    [detail.kind, invalidatePreview, targets],
  );

  const removeTarget = useCallback(
    (targetKey: string) => {
      setTargets((current) => current.filter((target) => target.targetKey !== targetKey));
      invalidatePreview();
    },
    [invalidatePreview],
  );

  const updateTarget = useCallback(
    (targetKey: string, patch: Partial<OptionSetMaterializationTarget>, keepPreview = false) => {
      setTargets((current) =>
        current.map((target) => (target.targetKey === targetKey ? { ...target, ...patch } : target)),
      );
      if (!keepPreview) invalidatePreview();
    },
    [invalidatePreview],
  );

  const selectedTargets = targets.filter((target) => target.selected);
  const hasApplicablePreview = Boolean(preview?.targets.some((target) => target.status === 'ready'));
  const request = useCallback(
    () =>
      makeOptionSetMaterializationRequest(detail.version, createOptionSetIdempotencyKey(), selectedTargets, entryIds),
    [detail.version, entryIds, selectedTargets],
  );

  const runPreview = useCallback(async () => {
    if (isDirty || isLoadingTargets || !allEntriesPersisted) return;
    const nextRequest = request();
    if (!nextRequest) return;
    setIsWorking(true);
    setError(null);
    setResult(null);
    try {
      const nextPreview = await previewOptionSetAttachments(detail.id, nextRequest);
      setPreview(nextPreview);
      setPreviewRequest(nextRequest);
    } catch (previewError) {
      setError(getErrorMessage(previewError) ?? 'option_set_materialization_error');
      setPreview(null);
      setPreviewRequest(null);
    } finally {
      setIsWorking(false);
    }
  }, [allEntriesPersisted, detail.id, isDirty, isLoadingTargets, request]);

  const missingReasonTargets = useMemo(() => {
    const required = new Set(
      (preview?.relatedOfferWarnings ?? [])
        .filter((warning) => warning.reasonRequired)
        .map((warning) => warning.targetKey),
    );
    return [...required].filter((targetKey) => {
      const target = targets.find((row) => row.targetKey === targetKey);
      return !target?.intentionalDifferenceReason.trim();
    });
  }, [preview?.relatedOfferWarnings, targets]);

  const runApply = useCallback(async () => {
    if (
      !preview ||
      !previewRequest ||
      !hasApplicablePreview ||
      !feature.enabled ||
      isDirty ||
      missingReasonTargets.length ||
      detail.status === 'archived'
    )
      return;
    const applyRequest = addDifferenceReasons(previewRequest, targets);
    setIsWorking(true);
    setError(null);
    try {
      const applied = await applyOptionSetAttachments(detail.id, applyRequest);
      setResult(applied);
      onApplied();
    } catch (applyError) {
      setError(getErrorMessage(applyError) ?? 'option_set_materialization_error');
    } finally {
      setIsWorking(false);
    }
  }, [
    detail.id,
    detail.status,
    feature.enabled,
    hasApplicablePreview,
    isDirty,
    missingReasonTargets.length,
    onApplied,
    preview,
    previewRequest,
    targets,
  ]);

  return {
    targets,
    targetErrors,
    preview,
    result,
    error,
    feature,
    isLoadingTargets,
    isWorking,
    allEntriesPersisted,
    missingReasonTargets,
    canPreview: !isDirty && !isLoadingTargets && allEntriesPersisted && selectedTargets.length > 0,
    canApply:
      Boolean(preview && previewRequest) &&
      hasApplicablePreview &&
      feature.enabled &&
      !isDirty &&
      !isWorking &&
      missingReasonTargets.length === 0 &&
      detail.status !== 'archived',
    addProduct,
    removeTarget,
    updateTarget,
    reloadTargets: () => setTargetReloadKey((value) => value + 1),
    runPreview,
    runApply,
  };
}
