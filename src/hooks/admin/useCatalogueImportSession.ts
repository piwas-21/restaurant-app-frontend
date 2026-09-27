'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCatalogueImportSession,
  startCatalogueImportSession,
  type CatalogueImportResult,
  type CatalogueImportSession,
} from '@/services/catalogueImportService';
import { getCatalogueRevisionChanges, type CatalogueRevisionChanges } from '@/services/catalogueRevisionChangeService';
import { getErrorMessage } from '@/utils/apiClient';

export interface CatalogueImportStartOptions {
  readonly templateId: string;
  readonly revision: number;
  readonly locale: string;
  readonly selectedTemplateIds: readonly string[];
  readonly createNewCopy: boolean;
  readonly sessionId?: string;
  readonly onSessionCreated: (sessionId: string) => void;
}

const randomKey = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const isFinished = (status: CatalogueImportSession['status']) =>
  status === 'Imported' || status === 'PartiallyImported' || status === 'Failed';

function resultFromSession(session: CatalogueImportSession): CatalogueImportResult {
  return {
    sessionId: session.sessionId,
    version: session.version,
    status: session.status,
    items: session.items.map((item) => ({
      templateId: item.templateId,
      revision: item.revision,
      status: item.status,
      localEntityType: item.localEntityType,
      localEntityId: item.localEntityId,
      failureCode: item.failureCode,
    })),
  };
}

export function useCatalogueImportSession(options: CatalogueImportStartOptions) {
  const [session, setSession] = useState<CatalogueImportSession | null>(null);
  const [result, setResult] = useState<CatalogueImportResult | null>(null);
  const [revisionChanges, setRevisionChanges] = useState<CatalogueRevisionChanges | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const refresh = useCallback(async (sessionId: string) => {
    const loaded = await getCatalogueImportSession(sessionId);
    setSession(loaded);
    if (isFinished(loaded.status)) setResult(resultFromSession(loaded));
    return loaded;
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const initialize = async () => {
      try {
        let sessionId = options.sessionId;
        if (!sessionId) {
          const startKeyName = `catalogue-import-start:${options.templateId}@${options.revision}:${options.locale}:${options.createNewCopy}:${[...options.selectedTemplateIds].sort().join(',')}`;
          let idempotencyKey: string | null = null;
          try {
            idempotencyKey = sessionStorage.getItem(startKeyName);
          } catch (storageError) {
            void storageError;
            /* Use an in-memory key below. */
          }
          idempotencyKey ??= randomKey();
          try {
            sessionStorage.setItem(startKeyName, idempotencyKey);
          } catch (storageError) {
            void storageError;
            /* Idempotency remains in the request. */
          }
          sessionId = (
            await startCatalogueImportSession({
              templateId: options.templateId,
              revision: options.revision,
              locale: options.locale,
              idempotencyKey,
              selectedTemplateIds: options.selectedTemplateIds,
              createNewCopy: options.createNewCopy,
            })
          ).sessionId;
          try {
            sessionStorage.removeItem(startKeyName);
          } catch (storageError) {
            void storageError;
            /* The created session is in the URL now. */
          }
        }
        const loaded = await refresh(sessionId);
        if (isFinished(loaded.status))
          setRevisionChanges(await getCatalogueRevisionChanges(sessionId).catch(() => null));
        if (!options.sessionId) options.onSessionCreated(sessionId);
      } catch (loadError) {
        setError(getErrorMessage(loadError) ?? 'catalogue_import_load_error');
      } finally {
        setIsLoading(false);
      }
    };
    void initialize();
  }, [options, refresh]);

  useEffect(() => {
    if (!session || session.status !== 'Importing') return;
    const timer = window.setTimeout(() => {
      void refresh(session.sessionId)
        .then((loaded) => {
          if (isFinished(loaded.status)) {
            return getCatalogueRevisionChanges(session.sessionId)
              .then(setRevisionChanges)
              .catch(() => undefined);
          }
          return undefined;
        })
        .catch(() => undefined);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [refresh, session]);

  return { session, result, revisionChanges, isLoading, error, refresh, setResult, setRevisionChanges };
}
