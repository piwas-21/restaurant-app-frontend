'use client';

import {
  archiveGlobalVariation,
  getArchivedGlobalVariations,
  restoreGlobalVariation,
} from '@/services/globalVariationService';
import { useLibraryArchive } from './useLibraryArchive';

interface UseGlobalVariationArchiveArgs {
  /** The picker is open. Nothing is fetched while it is closed. */
  isOpen: boolean;
  /** The admin is looking at the archived view. The archived list is fetched only then. */
  isViewingArchive: boolean;
  /** Reload the browsable catalog — a row that moved side to side must leave the other list. */
  onCatalogChanged: () => void;
}

/**
 * The variation library's archive drawer (plan S4) — the ingredient drawer's twin, over three
 * different endpoints and three different sentences.
 *
 * All of the behaviour is `useLibraryArchive`. The keys are literals so `check-t-keys` can see them.
 */
export function useGlobalVariationArchive({
  isOpen,
  isViewingArchive,
  onCatalogChanged,
}: UseGlobalVariationArchiveArgs) {
  return useLibraryArchive({
    isOpen,
    isViewingArchive,
    onCatalogChanged,
    fetchArchived: getArchivedGlobalVariations,
    archiveRow: archiveGlobalVariation,
    restoreRow: restoreGlobalVariation,
    messages: {
      loadFailed: 'variation_library_load_failed',
      archiveFailed: 'variation_library_archive_failed',
      restoreFailed: 'variation_library_restore_failed',
    },
  });
}

export default useGlobalVariationArchive;
