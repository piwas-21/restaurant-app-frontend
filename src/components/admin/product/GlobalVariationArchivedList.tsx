'use client';

import React from 'react';
import GlobalVariationPickerRow from './GlobalVariationPickerRow';
import LibraryPickerResults from './LibraryPickerResults';
import type { useGlobalVariationArchive } from '@/hooks/admin/useGlobalVariationArchive';

interface GlobalVariationArchivedListProps {
  /** The archive hook the picker already holds — one instance, so both lists agree. */
  archive: ReturnType<typeof useGlobalVariationArchive>;
}

/**
 * The archived half of the variation library: retired rows, each with a Restore action, and
 * nothing to tick.
 *
 * Its own component only because the picker modal is capped at 200 lines and this is the branch it
 * can lose without the reader losing the plot: the modal keeps the state and the writes, this keeps
 * the shape of a list that has exactly one action.
 */
export default function GlobalVariationArchivedList({ archive }: Readonly<GlobalVariationArchivedListProps>) {
  return (
    <LibraryPickerResults
      status={archive.status}
      loadError={archive.loadError}
      onRetry={archive.reload}
      isEmpty={archive.rows.length === 0}
      emptyKey="variation_library_archived_empty"
      retryKey="variation_library_retry"
    >
      {archive.rows.map((variation) => (
        <GlobalVariationPickerRow
          key={variation.id}
          variation={variation}
          archived
          onRestore={() => void archive.restore(variation.id)}
          isPending={archive.pendingId === variation.id}
        />
      ))}
    </LibraryPickerResults>
  );
}
