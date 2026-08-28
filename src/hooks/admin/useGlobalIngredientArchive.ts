'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  archiveGlobalIngredient,
  getArchivedGlobalIngredients,
  restoreGlobalIngredient,
  type GlobalIngredientSummary,
} from '@/services/globalIngredientService';
import { getErrorMessage } from '@/utils/apiClient';
import { serverMessage } from '@/utils/apiFormErrors';
import { useStableT } from '@/hooks/useStableT';
import type { LibraryStatus } from './useGlobalIngredientLibrary';

interface UseGlobalIngredientArchiveArgs {
  /** The picker is open. Nothing is fetched while it is closed. */
  isOpen: boolean;
  /** The admin is looking at the archived view. The archived list is fetched only then. */
  isViewingArchive: boolean;
  /** Reload the browsable catalog — a row that moved side to side must leave the other list. */
  onCatalogChanged: () => void;
}

/**
 * The archive half of the library picker (plan S3): the archived list, plus the two writes that
 * move a row between the lists.
 *
 * Separate from `useGlobalIngredientLibrary` on purpose. That hook answers "what can I attach",
 * this one answers "what did we retire" — different endpoint, different lifetime (fetched only
 * when the archived view is opened, not on every modal open), and it is the only place in the
 * picker that WRITES. Keeping them apart also keeps both under the 200-line hook limit.
 *
 * Plan D4: deletion is soft, always. `DELETE` archives a row that is in use and soft-deletes one
 * that is not; either way it is reversible from here, and neither touches the copies already sitting
 * on products or on past orders.
 */
export function useGlobalIngredientArchive({
  isOpen,
  isViewingArchive,
  onCatalogChanged,
}: UseGlobalIngredientArchiveArgs) {
  const tRef = useStableT();
  const [rows, setRows] = useState<GlobalIngredientSummary[]>([]);
  const [status, setStatus] = useState<LibraryStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!isOpen || !isViewingArchive) return;

    let cancelled = false;
    setStatus('loading');
    setLoadError(null);

    const load = async () => {
      try {
        const response = await getArchivedGlobalIngredients();
        if (cancelled) return;
        if (!response?.success) {
          setRows([]);
          setLoadError(serverMessage(response) ?? tRef.current('ingredient_library_load_failed'));
          setStatus('error');
          return;
        }
        setRows(response.data ?? []);
        setStatus('ready');
      } catch (error) {
        if (cancelled) return;
        setRows([]);
        setLoadError(getErrorMessage(error) ?? tRef.current('ingredient_library_load_failed'));
        setStatus('error');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, isViewingArchive, reloadToken, tRef]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  /**
   * One shape for both writes: the failure is reported in place and BOTH lists are refreshed on
   * success, because every success moves a row from one of them to the other.
   */
  const run = useCallback(
    async (
      id: string,
      call: (id: string) => Promise<{ success: boolean; errors?: string[]; message?: string } | undefined>,
      failureKey: string,
    ): Promise<boolean> => {
      setPendingId(id);
      setActionError(null);
      try {
        const response = await call(id);
        if (!response?.success) {
          setActionError(serverMessage(response) ?? tRef.current(failureKey));
          return false;
        }
        reload();
        onCatalogChanged();
        return true;
      } catch (error) {
        setActionError(getErrorMessage(error) ?? tRef.current(failureKey));
        return false;
      } finally {
        setPendingId(null);
      }
    },
    [onCatalogChanged, reload, tRef],
  );

  const archive = useCallback(
    (id: string) => run(id, archiveGlobalIngredient, 'ingredient_library_archive_failed'),
    [run],
  );

  const restore = useCallback(
    (id: string) => run(id, restoreGlobalIngredient, 'ingredient_library_restore_failed'),
    [run],
  );

  return { rows, status, loadError, actionError, pendingId, reload, archive, restore };
}

export default useGlobalIngredientArchive;
