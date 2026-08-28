'use client';

import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '@/utils/apiClient';
import { serverMessage } from '@/utils/apiFormErrors';
import { useStableT } from '@/hooks/useStableT';

/** The four states a library list can be in while it is being read. */
export type LibraryStatus = 'loading' | 'ready' | 'error';

/** The envelope shape both catalog services answer with; only these three fields are read here. */
interface LibraryResponse<T> {
  data?: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

/** A row the archive drawer can render: it needs an identity and nothing else. */
interface ArchivableRow {
  id: string;
}

interface UseLibraryArchiveArgs<TRow extends ArchivableRow> {
  /** The picker is open. Nothing is fetched while it is closed. */
  isOpen: boolean;
  /** The admin is looking at the archived view. The archived list is fetched only then. */
  isViewingArchive: boolean;
  /** Reload the browsable catalog — a row that moved side to side must leave the other list. */
  onCatalogChanged: () => void;
  /** `GET .../archived` for this catalog. */
  fetchArchived: () => Promise<LibraryResponse<TRow[]> | undefined>;
  /** `DELETE .../{id}` — archives a row in use, soft-deletes an unused one. */
  archiveRow: (id: string) => Promise<LibraryResponse<unknown> | undefined>;
  /** `POST .../{id}/restore`. */
  restoreRow: (id: string) => Promise<LibraryResponse<unknown> | undefined>;
  /**
   * The three literal translation keys this catalog reports its failures with. Passed in rather
   * than derived from a prefix so `check-t-keys` can still see every key that is used.
   */
  messages: { loadFailed: string; archiveFailed: string; restoreFailed: string };
}

/**
 * The archive half of a library picker (plan S3 for ingredients, S4 for variations): the archived
 * list, plus the two writes that move a row between the lists.
 *
 * One hook for both catalogs. What differs between them is three endpoints and three sentences;
 * what does not differ is the part that is easy to get subtly wrong — fetching only when the drawer
 * is actually opened, cancelling an in-flight read, holding exactly one row at a time, and
 * refreshing BOTH lists on success because every success moves a row from one to the other. A
 * second copy of that is a second thing to keep in step.
 *
 * Separate from the browse hook on purpose. That one answers "what can I attach", this one answers
 * "what did we retire" — different endpoint, different lifetime, and this is the only place in a
 * picker that WRITES. Keeping them apart also keeps both under the 200-line hook limit.
 *
 * Plan D4: deletion is soft, always. Either branch is reversible from here, and neither touches the
 * copies already sitting on products or on past orders.
 */
export function useLibraryArchive<TRow extends ArchivableRow>({
  isOpen,
  isViewingArchive,
  onCatalogChanged,
  fetchArchived,
  archiveRow,
  restoreRow,
  messages,
}: UseLibraryArchiveArgs<TRow>) {
  const tRef = useStableT();
  const [rows, setRows] = useState<TRow[]>([]);
  const [status, setStatus] = useState<LibraryStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const { loadFailed, archiveFailed, restoreFailed } = messages;

  useEffect(() => {
    if (!isOpen || !isViewingArchive) return;

    let cancelled = false;
    setStatus('loading');
    setLoadError(null);

    const load = async () => {
      try {
        const response = await fetchArchived();
        if (cancelled) return;
        if (!response?.success) {
          setRows([]);
          setLoadError(serverMessage(response) ?? tRef.current(loadFailed));
          setStatus('error');
          return;
        }
        setRows(response.data ?? []);
        setStatus('ready');
      } catch (error) {
        if (cancelled) return;
        setRows([]);
        setLoadError(getErrorMessage(error) ?? tRef.current(loadFailed));
        setStatus('error');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, isViewingArchive, reloadToken, tRef, fetchArchived, loadFailed]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  /**
   * One shape for both writes: the failure is reported in place and BOTH lists are refreshed on
   * success, because every success moves a row from one of them to the other.
   */
  const run = useCallback(
    async (
      id: string,
      call: (id: string) => Promise<LibraryResponse<unknown> | undefined>,
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

  const archive = useCallback((id: string) => run(id, archiveRow, archiveFailed), [run, archiveRow, archiveFailed]);
  const restore = useCallback((id: string) => run(id, restoreRow, restoreFailed), [run, restoreRow, restoreFailed]);

  return { rows, status, loadError, actionError, pendingId, reload, archive, restore };
}

export default useLibraryArchive;
