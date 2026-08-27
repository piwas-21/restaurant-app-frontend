'use client';

import React from 'react';
import GlobalIngredientPickerRow from './GlobalIngredientPickerRow';
import GlobalIngredientPickerResults from './GlobalIngredientPickerResults';
import type { useGlobalIngredientArchive } from '@/hooks/admin/useGlobalIngredientArchive';

interface GlobalIngredientArchivedListProps {
  /** The archive hook the picker already holds — one instance, so both lists agree. */
  archive: ReturnType<typeof useGlobalIngredientArchive>;
}

/**
 * The archived half of the library: retired rows, each with a Restore action, and nothing to tick.
 *
 * Its own component only because the picker modal is capped at 200 lines and this is the branch it
 * can lose without the reader losing the plot: the modal keeps the state and the writes, this keeps
 * the shape of a list that has exactly one action.
 */
export default function GlobalIngredientArchivedList({ archive }: Readonly<GlobalIngredientArchivedListProps>) {
  return (
    <GlobalIngredientPickerResults
      status={archive.status}
      loadError={archive.loadError}
      onRetry={archive.reload}
      isEmpty={archive.rows.length === 0}
      emptyKey="ingredient_library_archived_empty"
    >
      {archive.rows.map((ingredient) => (
        <GlobalIngredientPickerRow
          key={ingredient.id}
          ingredient={ingredient}
          archived
          onRestore={() => void archive.restore(ingredient.id)}
          isPending={archive.pendingId === ingredient.id}
        />
      ))}
    </GlobalIngredientPickerResults>
  );
}
