'use client';

import React from 'react';
import LibraryPickerResults from './LibraryPickerResults';
import LibraryPickerRow, { type LibraryPickerRowData } from './LibraryPickerRow';
import type { LibraryPickerCopy } from './libraryPickerCopy';
import type { LibraryArchive } from '@/hooks/admin/useLibraryArchive';

interface LibraryArchivedListProps<TRow extends LibraryPickerRowData> {
  /** The archive hook the picker already holds — one instance, so both lists agree. */
  archive: LibraryArchive<TRow>;
  /** Which catalog's words to render. */
  copy: LibraryPickerCopy;
}

/**
 * The archived half of a library: retired rows, each with a Restore action, and nothing to tick.
 *
 * Its own component only because the picker shell is capped at 250 lines and this is the branch it
 * can lose without the reader losing the plot: the shell keeps the state and the writes, this keeps
 * the shape of a list that has exactly one action.
 */
export default function LibraryArchivedList<TRow extends LibraryPickerRowData>({
  archive,
  copy,
}: Readonly<LibraryArchivedListProps<TRow>>) {
  return (
    <LibraryPickerResults
      status={archive.status}
      loadError={archive.loadError}
      onRetry={archive.reload}
      isEmpty={archive.rows.length === 0}
      emptyKey={copy.archivedEmpty}
      retryKey={copy.retry}
    >
      {archive.rows.map((retired) => (
        <LibraryPickerRow
          key={retired.id}
          row={retired}
          copy={copy}
          archived
          onRestore={() => void archive.restore(retired.id)}
          isPending={archive.pendingId === retired.id}
        />
      ))}
    </LibraryPickerResults>
  );
}
