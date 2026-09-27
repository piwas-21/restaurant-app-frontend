'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  importCatalogueSession,
  previewCatalogueImport,
  updateCatalogueImportItems,
  type CatalogueImportDecision,
  type CatalogueImportPreview,
} from '@/services/catalogueImportService';
import { getCatalogueRevisionChanges } from '@/services/catalogueImportService';
import { getErrorMessage } from '@/utils/apiClient';
import { useCatalogueImportSession, type CatalogueImportStartOptions } from './useCatalogueImportSession';

const itemKey = (templateId: string, revision: number) => `${templateId}@${revision}`;
const randomKey = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
        flow.session.items.map((item) => [
          itemKey(item.templateId, item.revision),
          item.decision ?? { templateId: item.templateId, revision: item.revision, resolution: 'Create' },
        ]),
      ),
    );
  }, [flow.session]);

  const toggleSelection = useCallback((templateId: string, selected: boolean) => {
    setSelectedIds((current) =>
      selected ? [...new Set([...current, templateId])] : current.filter((id) => id !== templateId),
    );
    setPreview(null);
  }, []);

  const updateDecision = useCallback((key: string, patch: Partial<CatalogueImportDecision>) => {
    setDecisions((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
    setPreview(null);
  }, []);

  const chosenItems = useMemo(
    () => flow.session?.items.filter((item) => selectedIds.includes(item.templateId)) ?? [],
    [flow.session, selectedIds],
  );

  const persistDecisions = useCallback(async () => {
    if (!flow.session) return null;
    await updateCatalogueImportItems(flow.session.sessionId, {
      expectedVersion: flow.session.version,
      selectedTemplateIds: selectedIds,
      decisions: chosenItems.map(
        (item) =>
          decisions[itemKey(item.templateId, item.revision)] ?? {
            templateId: item.templateId,
            revision: item.revision,
            resolution: 'Create',
          },
      ),
    });
    return flow.refresh(flow.session.sessionId);
  }, [chosenItems, decisions, flow, selectedIds]);

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
    if (!flow.session) return;
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
      } catch (storageError) {
        void storageError;
        /* Use the in-memory key below. */
      }
      idempotencyKey ??= importKeys.current[saved.sessionId] ?? randomKey();
      importKeys.current[saved.sessionId] = idempotencyKey;
      try {
        sessionStorage.setItem(keyName, idempotencyKey);
      } catch (storageError) {
        void storageError;
        /* Keep the key in memory for retries. */
      }
      flow.setResult(await importCatalogueSession(saved.sessionId, { expectedVersion: saved.version, idempotencyKey }));
      await flow.refresh(saved.sessionId);
      flow.setRevisionChanges(await getCatalogueRevisionChanges(saved.sessionId).catch(() => null));
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
    chosenItems,
    isLoading: flow.isLoading,
    isWorking,
    error: actionError ?? flow.error,
    toggleSelection,
    updateDecision,
    checkPreview,
    runImport,
  };
}
