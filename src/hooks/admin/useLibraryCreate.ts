'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '@/utils/apiClient';
import { serverMessage } from '@/utils/apiFormErrors';
import type { LibraryPickerCopy } from '@/components/admin/product/libraryPickerCopy';
import type { CatalogRow } from './useLibraryCatalog';
import type { LibraryResponse } from './useLibraryArchive';

interface UseLibraryCreateArgs<TRow extends CatalogRow> {
  copy: LibraryPickerCopy;
  /** `POST /api/<catalog>` for the name the search did not find. */
  createRow: (defaultName: string) => Promise<LibraryResponse<TRow> | undefined>;
  /** Hands the created row to the caller, which attaches it with everything already ticked. */
  onCreated: (row: TRow) => void;
}

/**
 * The picker's own write: create the row the search did not find.
 *
 * Split out of `LibraryPickerShell`, which the §4 gate holds at 250 lines — the shell is about
 * SELECTION, and this is the one thing in it that writes.
 *
 * **What it fixes as it moves.** With an empty search box the shell's version returned early and
 * the button did NOTHING: enabled, labelled "Create a new variation", inert. It creates from the
 * search TERM, so with nothing typed there is nothing to create; the honest answer is to say so and
 * put the caret where the name goes. Deliberately not a `disabled` button — a disabled control
 * explains nothing (#208), which is the same call the guest sheet's Continue records.
 */
export function useLibraryCreate<TRow extends CatalogRow>({ copy, createRow, onCreated }: UseLibraryCreateArgs<TRow>) {
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** So a refused create can put the caret in the box whose emptiness it is complaining about. */
  const searchRef = useRef<HTMLInputElement>(null);

  const create = useCallback(
    async (name: string) => {
      if (isCreating) return;
      if (name.length === 0) {
        setError(t(copy.createNeedsName));
        searchRef.current?.focus();
        return;
      }
      setIsCreating(true);
      setError(null);
      try {
        const response = await createRow(name);
        if (!response?.success || !response.data?.id) {
          setError(serverMessage(response) ?? t(copy.createFailed));
          return;
        }
        onCreated(response.data);
      } catch (error_) {
        // `error_`, not `error`: the state slot above owns that name in this scope, and a
        // trailing underscore is the convention Sonar S7718 asks for in exactly that case.
        setError(getErrorMessage(error_) ?? t(copy.createFailed));
      } finally {
        setIsCreating(false);
      }
    },
    [copy, createRow, isCreating, onCreated, t],
  );

  return { isCreating, error, setError, searchRef, create };
}

export default useLibraryCreate;
