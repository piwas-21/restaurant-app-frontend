'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  importCatalogueSession,
  previewCatalogueImport,
  updateCatalogueImportItems,
  type CatalogueImportDecision,
  type CatalogueImportPreview,
  type CatalogueImportSessionItem,
} from '@/services/catalogueImportService';
import {
  applyCatalogueRevisionChanges,
  type CatalogueRevisionChanges,
} from '@/services/catalogueRevisionChangeService';
import {
  canEditCatalogueImportDecision,
  canManageCatalogueImportSession,
  catalogueImportDecisionFor,
  catalogueImportDecisionForRequest,
  hasEmptyCustomOrderTypesInSelection,
} from '@/utils/catalogueImportDecision';
import { getErrorMessage } from '@/utils/apiClient';
import { createIdempotencyKey } from '@/utils/idempotencyKey';
import { useCatalogueImportSession, type CatalogueImportStartOptions } from './useCatalogueImportSession';

const itemKey = (templateId: string, revision: number) => `${templateId}@${revision}`;
export function useCatalogueImportWorkspace(options: CatalogueImportStartOptions) {
  const flow = useCatalogueImportSession(options);
  const [selectedIds, setSelectedIds] = useState<string[]>([...options.selectedTemplateIds]);
  const [decisions, setDecisions] = useState<Record<string, CatalogueImportDecision>>({});
  const [preview, setPreview] = useState<CatalogueImportPreview | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const importKeys = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!flow.session) return;
    setSelectedIds(flow.session.items.filter((item) => item.isSelected).map((item) => item.templateId));
    setDecisions(
      Object.fromEntries(
        flow.session.items.map((item) => [itemKey(item.templateId, item.revision), catalogueImportDecisionFor(item)]),
      ),
    );
  }, [flow.session]);

  const toggleSelection = useCallback(
    (templateId: string, selected: boolean) => {
      if (flow.session?.status !== 'Draft') return;
      setSelectedIds((current) =>
        selected ? [...new Set([...current, templateId])] : current.filter((id) => id !== templateId),
      );
      setPreview(null);
    },
    [flow.session],
  );

  const updateDecision = useCallback(
    (key: string, patch: Partial<CatalogueImportDecision>) => {
      const item = flow.session?.items.find((candidate) => itemKey(candidate.templateId, candidate.revision) === key);
      if (!flow.session || !item || !canEditCatalogueImportDecision(flow.session, item)) return;
      setDecisions((current) => ({
        ...current,
        [key]: { ...catalogueImportDecisionFor(item), ...current[key], ...patch },
      }));
      setPreview(null);
    },
    [flow.session],
  );

  const chosenItems = useMemo(
    () => flow.session?.items.filter((item) => selectedIds.includes(item.templateId)) ?? [],
    [flow.session, selectedIds],
  );
  const hasInvalidCustomOrderTypes = hasEmptyCustomOrderTypesInSelection(chosenItems, decisions);

  const persistDecisions = useCallback(async () => {
    if (!flow.session) return null;
    if (hasInvalidCustomOrderTypes) {
      setActionError('catalogue_import_order_type_required');
      return null;
    }
    if (!canManageCatalogueImportSession(flow.session)) return flow.session;
    const retrying = flow.session.status === 'PartiallyImported' || flow.session.status === 'Failed';
    await updateCatalogueImportItems(flow.session.sessionId, {
      expectedVersion: flow.session.version,
      selectedTemplateIds: selectedIds,
      decisions: chosenItems
        .filter((item) => !retrying || item.status === 'Failed')
        .map((item) =>
          catalogueImportDecisionForRequest(
            decisions[itemKey(item.templateId, item.revision)] ?? catalogueImportDecisionFor(item),
            item.type,
          ),
        ),
    });
    return flow.refresh(flow.session.sessionId);
  }, [chosenItems, decisions, flow, hasInvalidCustomOrderTypes, selectedIds]);

  const applyRevisionFields = useCallback(
    async (item: CatalogueRevisionChanges['items'][number], fieldPaths: readonly string[]) => {
      if (!flow.session || !flow.revisionChanges || fieldPaths.length === 0) return;
      if (item.withdrawn || item.currentRevision == null || !item.currentContentHash) return;
      setIsWorking(true);
      setActionError(null);
      try {
        await applyCatalogueRevisionChanges(flow.session.sessionId, {
          expectedSessionVersion: flow.revisionChanges.sessionVersion,
          templateId: item.templateId,
          adoptedRevision: item.adoptedRevision,
          currentRevision: item.currentRevision,
          currentContentHash: item.currentContentHash,
          expectedLocalHash: item.localHash,
          fieldPaths,
        });
        await flow.refresh(flow.session.sessionId);
        await flow.refreshRevisionChanges(flow.session.sessionId);
      } catch (revisionError) {
        setActionError(getErrorMessage(revisionError) ?? 'catalogue_revision_apply_error');
      } finally {
        setIsWorking(false);
      }
    },
    [flow],
  );

  const checkPreview = useCallback(async () => {
    if (!flow.session) return;
    setIsWorking(true);
    setActionError(null);
    try {
      const saved = await persistDecisions();
      if (saved) setPreview(await previewCatalogueImport(saved.sessionId));
    } catch (previewError) {
      setActionError(getErrorMessage(previewError) ?? 'catalogue_import_preview_error');
    } finally {
      setIsWorking(false);
    }
  }, [flow.session, persistDecisions]);

  const runImport = useCallback(async () => {
    if (!flow.session || !canManageCatalogueImportSession(flow.session)) return;
    setIsWorking(true);
    setActionError(null);
    try {
      const saved = await persistDecisions();
      if (!saved) return;
      const checked = await previewCatalogueImport(saved.sessionId);
      setPreview(checked);
      if (checked.items.some((item) => item.isSelected && item.blockingIssues.length > 0)) return;
      const keyName = `catalogue-import-idempotency:${saved.sessionId}`;
      let idempotencyKey: string | null = null;
      try {
        idempotencyKey = sessionStorage.getItem(keyName);
      } catch (_storageError) {
        /* Intentionally ignore unavailable session storage; the in-memory key supports retries. */
      }
      idempotencyKey ??= importKeys.current[saved.sessionId] ?? createIdempotencyKey();
      importKeys.current[saved.sessionId] = idempotencyKey;
      try {
        sessionStorage.setItem(keyName, idempotencyKey);
      } catch (_storageError) {
        /* Intentionally ignore unavailable session storage; the key remains in memory for retries. */
      }
      flow.setResult(await importCatalogueSession(saved.sessionId, { expectedVersion: saved.version, idempotencyKey }));
      await flow.refresh(saved.sessionId);
      await flow.refreshRevisionChanges(saved.sessionId);
    } catch (importError) {
      setActionError(getErrorMessage(importError) ?? 'catalogue_import_apply_error');
    } finally {
      setIsWorking(false);
    }
  }, [flow, persistDecisions]);

  return {
    session: flow.session,
    selectedIds,
    decisions,
    preview,
    result: flow.result,
    revisionChanges: flow.revisionChanges,
    revisionChangesState: flow.revisionChangesState,
    canManage: flow.session ? canManageCatalogueImportSession(flow.session) : false,
    canEditSelection: flow.session?.status === 'Draft',
    canEditDecision: (item: CatalogueImportSessionItem) =>
      flow.session ? canEditCatalogueImportDecision(flow.session, item) : false,
    chosenItems,
    hasInvalidCustomOrderTypes,
    isLoading: flow.isLoading,
    isWorking,
    error: actionError ?? flow.error,
    toggleSelection,
    updateDecision,
    checkPreview,
    runImport,
    applyRevisionFields,
  };
}
