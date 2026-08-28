'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import GlobalVariationPickerRow from './GlobalVariationPickerRow';
import GlobalVariationArchivedList from './GlobalVariationArchivedList';
import GlobalVariationPickerFooter from './GlobalVariationPickerFooter';
import GlobalVariationPickerToolbar, { type VariationLibraryView } from './GlobalVariationPickerToolbar';
import LibraryPickerResults from './LibraryPickerResults';
import { useGlobalVariationLibrary } from '@/hooks/admin/useGlobalVariationLibrary';
import { useGlobalVariationArchive } from '@/hooks/admin/useGlobalVariationArchive';
import { createGlobalVariation, type GlobalVariationSummary } from '@/services/globalVariationService';
import { getErrorMessage } from '@/utils/apiClient';
import { serverMessage } from '@/utils/apiFormErrors';
import { toProductVariation } from './globalVariationLibrary';
import type { Variation } from './types';
// Shares the ingredient picker's stylesheet — see `GlobalVariationPickerToolbar`.
import styles from './GlobalIngredientPickerModal.module.css';

interface GlobalVariationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The product's current variations — what "already added" is measured against. */
  attached: Pick<Variation, 'name' | 'globalVariationId'>[];
  /**
   * The `displayOrder` the first appended row takes. One PAST the highest in use, not the row
   * count: `useVariationReorder` (#593) documents that live `displayOrder` data holds gaps and
   * duplicates, so counting rows would land a picked row on top of an existing one.
   */
  nextDisplayOrder: number;
  /**
   * Receives the picked rows, already mapped to product variations. The caller APPENDS each one to
   * its react-hook-form field array — this modal never touches the form itself.
   */
  onAdd: (variations: Variation[]) => void;
}

/**
 * Browse the global variation library and attach rows to the product (plan S4).
 *
 * The catalog is 50 seeded rows in nine languages (backend #431) and, until this modal, no screen
 * listed it — variations had to be typed by hand on every product, translations and all. Picking a
 * row copies its name and its nine translations onto the product and records `globalVariationId`
 * as provenance. Copy semantics (plan D3): what is attached is the product's own from that moment,
 * and a later edit of the library row does NOT propagate.
 *
 * **What it does NOT copy is the price, because the catalog does not have one.** A variation's
 * money is its `PriceModifier`, and that is more product-specific than an ingredient's price ever
 * was — "Large" is +2.00 on a pizza and +0.50 on a coffee. Every picked row therefore lands at a
 * modifier of 0, which is neutral rather than wrong, and the admin types the one fact the library
 * could never have known.
 *
 * **How it differs from the ingredient picker, and why.** That one calls `changeIngredients` with a
 * whole new array, because `ProductIngredientsManager` owns its rows as component state. Variations
 * are a react-hook-form field array, so this modal hands the mapped rows back and the caller
 * APPENDS them one at a time — replacing the array would discard react-hook-form's per-row `field.id`
 * and every registration bound to an index, which is not a re-render but a remount of the whole
 * table.
 */
export default function GlobalVariationPickerModal({
  isOpen,
  onClose,
  attached,
  nextDisplayOrder,
  onAdd,
}: Readonly<GlobalVariationPickerModalProps>) {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<VariationLibraryView>('active');
  const library = useGlobalVariationLibrary({ isOpen, attached, languageCode: i18n.language });
  const archive = useGlobalVariationArchive({
    isOpen,
    isViewingArchive: view === 'archived',
    onCatalogChanged: library.reload,
  });
  const [selected, setSelected] = useState<GlobalVariationSummary[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const close = () => {
    setSelected([]);
    setCreateError(null);
    setView('active');
    library.reset();
    onClose();
  };

  const toggle = (variation: GlobalVariationSummary, checked: boolean) => {
    setSelected((previous) =>
      checked
        ? [...previous.filter((entry) => entry.id !== variation.id), variation]
        : previous.filter((entry) => entry.id !== variation.id),
    );
  };

  const add = (rows: GlobalVariationSummary[]) => {
    onAdd(rows.map((row, index) => toProductVariation(row, nextDisplayOrder + index)));
    close();
  };

  const newName = library.query.trim();

  /**
   * Create the row the search did not find, then attach it with everything already ticked.
   * `translations: []` is deliberate and legal: the backend builds its translation list from
   * whatever arrives, and a name typed into a search box has no translations yet.
   */
  const createAndAdd = async () => {
    if (newName.length === 0 || isCreating) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const response = await createGlobalVariation({ defaultName: newName, translations: [] });
      if (!response?.success || !response.data?.id) {
        setCreateError(serverMessage(response) ?? t('variation_library_create_failed'));
        return;
      }
      add([...selected, response.data]);
    } catch (error) {
      setCreateError(getErrorMessage(error) ?? t('variation_library_create_failed'));
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Retire a row, then take it out of the list on screen — in that order. Marking it first would
   * hide a row that is still there whenever the write fails.
   */
  const retire = async (variation: GlobalVariationSummary) => {
    const done = await archive.archive(variation.id);
    if (!done) return;
    library.markArchived(variation.id);
    setSelected((previous) => previous.filter((entry) => entry.id !== variation.id));
  };

  const footer = (
    <GlobalVariationPickerFooter
      view={view}
      newName={newName}
      isCreating={isCreating}
      onCreate={() => void createAndAdd()}
      onCancel={close}
      selectedCount={selected.length}
      onAdd={() => add(selected)}
    />
  );

  return (
    <BaseModal isOpen={isOpen} onClose={close} title={t('variation_library_title')} size="lg" footer={footer}>
      <GlobalVariationPickerToolbar
        view={view}
        onViewChange={setView}
        query={library.query}
        onQueryChange={library.setQuery}
        filter={library.filter}
        onFilterChange={library.setFilter}
      />

      {(createError ?? archive.actionError) && (
        <p className={styles.error} role="alert">
          {createError ?? archive.actionError}
        </p>
      )}

      {view === 'active' ? (
        <LibraryPickerResults
          status={library.status}
          loadError={library.loadError}
          onRetry={library.reload}
          isEmpty={library.matchCount === 0}
          emptyKey="variation_library_empty"
          retryKey="variation_library_retry"
          hiddenNote={
            library.matchCount > library.visible.length ? (
              <p className={styles.notice}>
                {t('variation_library_showing', { shown: library.visible.length, total: library.matchCount })}
              </p>
            ) : null
          }
        >
          {library.visible.map((variation) => (
            <GlobalVariationPickerRow
              key={variation.id}
              variation={variation}
              checked={selected.some((entry) => entry.id === variation.id)}
              alreadyAdded={library.isAttached(variation)}
              onToggle={(checked) => toggle(variation, checked)}
              onArchive={() => void retire(variation)}
              isPending={archive.pendingId === variation.id}
            />
          ))}
        </LibraryPickerResults>
      ) : (
        <GlobalVariationArchivedList archive={archive} />
      )}
    </BaseModal>
  );
}
