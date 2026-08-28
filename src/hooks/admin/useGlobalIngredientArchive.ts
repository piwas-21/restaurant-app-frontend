'use client';

import {
  archiveGlobalIngredient,
  getArchivedGlobalIngredients,
  restoreGlobalIngredient,
} from '@/services/globalIngredientService';
import { useLibraryArchive } from './useLibraryArchive';

interface UseGlobalIngredientArchiveArgs {
  /** The picker is open. Nothing is fetched while it is closed. */
  isOpen: boolean;
  /** The admin is looking at the archived view. The archived list is fetched only then. */
  isViewingArchive: boolean;
  /** Reload the browsable catalog — a row that moved side to side must leave the other list. */
  onCatalogChanged: () => void;
}

/**
 * The ingredient library's archive drawer (plan S3).
 *
 * The behaviour moved to `useLibraryArchive` unchanged when the variation library (plan S4) needed
 * the identical drawer; what is left here is the three endpoints and the three sentences that make
 * it the INGREDIENT drawer. The keys are literals so `check-t-keys` can still see them.
 */
export function useGlobalIngredientArchive({
  isOpen,
  isViewingArchive,
  onCatalogChanged,
}: UseGlobalIngredientArchiveArgs) {
  return useLibraryArchive({
    isOpen,
    isViewingArchive,
    onCatalogChanged,
    fetchArchived: getArchivedGlobalIngredients,
    archiveRow: archiveGlobalIngredient,
    restoreRow: restoreGlobalIngredient,
    messages: {
      loadFailed: 'ingredient_library_load_failed',
      archiveFailed: 'ingredient_library_archive_failed',
      restoreFailed: 'ingredient_library_restore_failed',
    },
  });
}

export default useGlobalIngredientArchive;
