'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import GlobalIngredientPickerRow from './GlobalIngredientPickerRow';
import GlobalIngredientArchivedList from './GlobalIngredientArchivedList';
import GlobalIngredientPickerResults from './GlobalIngredientPickerResults';
import GlobalIngredientPickerFooter from './GlobalIngredientPickerFooter';
import GlobalIngredientPickerToolbar, { type LibraryView } from './GlobalIngredientPickerToolbar';
import { useGlobalIngredientLibrary } from '@/hooks/admin/useGlobalIngredientLibrary';
import { useGlobalIngredientArchive } from '@/hooks/admin/useGlobalIngredientArchive';
import { createGlobalIngredient, type GlobalIngredientSummary } from '@/services/globalIngredientService';
import { getErrorMessage } from '@/utils/apiClient';
import { serverMessage } from '@/utils/apiFormErrors';
import { toProductIngredient } from './globalIngredientLibrary';
import type { ProductIngredient } from '@/types/menu';
import styles from './GlobalIngredientPickerModal.module.css';

interface GlobalIngredientPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The product's current ingredients — what "already added" is measured against. */
  attached: ProductIngredient[];
  /** Receives the picked rows, already mapped to product ingredients. */
  onAdd: (ingredients: ProductIngredient[]) => void;
}

/**
 * Browse the global ingredient library and attach rows to the product (plan S2), and keep it tidy
 * (plan S3).
 *
 * The library has been seeded with 654 entries in 9 languages since the GlobalIngredients migration
 * and no screen ever listed it: the only way in was a per-row type-ahead that needs you to guess the
 * English name first. Picking a row here copies its name and its translations onto the product — the
 * 10 free-text translation inputs this saves per ingredient are the whole point — and records
 * `globalIngredientId` as provenance. Copy semantics (plan D3): what is attached is the product's own
 * from that moment, and a later edit of the library row does NOT propagate — that needs the frozen
 * order history and is a later slice.
 *
 * S3 adds the two things a catalog nobody can prune eventually needs: what each row costs to change
 * ("used on N items"), and a way to retire one. Retiring is soft in every case (plan D4) and
 * reversible from the Archived view, so nothing an admin does here can reach a product that already
 * copied the row, let alone a past order.
 */
export default function GlobalIngredientPickerModal({
  isOpen,
  onClose,
  attached,
  onAdd,
}: Readonly<GlobalIngredientPickerModalProps>) {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<LibraryView>('active');
  const library = useGlobalIngredientLibrary({ isOpen, attached, languageCode: i18n.language });
  const archive = useGlobalIngredientArchive({
    isOpen,
    isViewingArchive: view === 'archived',
    onCatalogChanged: library.reload,
  });
  const [selected, setSelected] = useState<GlobalIngredientSummary[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const close = () => {
    setSelected([]);
    setCreateError(null);
    setView('active');
    library.reset();
    onClose();
  };

  const toggle = (ingredient: GlobalIngredientSummary, checked: boolean) => {
    setSelected((previous) =>
      checked
        ? [...previous.filter((entry) => entry.id !== ingredient.id), ingredient]
        : previous.filter((entry) => entry.id !== ingredient.id),
    );
  };

  const add = (rows: GlobalIngredientSummary[]) => {
    onAdd(rows.map((row, index) => toProductIngredient(row, attached.length + index)));
    close();
  };

  const newName = library.query.trim();

  /**
   * Create the row the search did not find, then attach it with everything already ticked.
   * `translations: []` is deliberate and legal — `defaultName` is the only field `/search` matches
   * on anyway — and it is what stops the reconciliation in `productFormUtils` from re-searching a
   * translation-less ingredient on every single save.
   */
  const createAndAdd = async () => {
    if (newName.length === 0 || isCreating) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const response = await createGlobalIngredient({ defaultName: newName, translations: [] });
      if (!response?.success || !response.data?.id) {
        setCreateError(serverMessage(response) ?? t('ingredient_library_create_failed'));
        return;
      }
      add([...selected, response.data]);
    } catch (error) {
      setCreateError(getErrorMessage(error) ?? t('ingredient_library_create_failed'));
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Retire a row, then take it out of the list on screen — in that order. Marking it first would
   * hide a row that is still there whenever the write fails.
   */
  const retire = async (ingredient: GlobalIngredientSummary) => {
    const done = await archive.archive(ingredient.id);
    if (!done) return;
    library.markArchived(ingredient.id);
    setSelected((previous) => previous.filter((entry) => entry.id !== ingredient.id));
  };

  const footer = (
    <GlobalIngredientPickerFooter
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
    <BaseModal isOpen={isOpen} onClose={close} title={t('add_from_library')} size="lg" footer={footer}>
      <GlobalIngredientPickerToolbar
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
        <GlobalIngredientPickerResults
          status={library.status}
          loadError={library.loadError}
          onRetry={library.reload}
          isEmpty={library.matchCount === 0}
          emptyKey="ingredient_library_empty"
          hiddenNote={
            library.matchCount > library.visible.length ? (
              <p className={styles.notice}>
                {t('ingredient_library_showing', { shown: library.visible.length, total: library.matchCount })}
              </p>
            ) : null
          }
        >
          {library.visible.map((ingredient) => (
            <GlobalIngredientPickerRow
              key={ingredient.id}
              ingredient={ingredient}
              checked={selected.some((entry) => entry.id === ingredient.id)}
              alreadyAdded={library.isAttached(ingredient)}
              onToggle={(checked) => toggle(ingredient, checked)}
              onArchive={() => void retire(ingredient)}
              isPending={archive.pendingId === ingredient.id}
            />
          ))}
        </GlobalIngredientPickerResults>
      ) : (
        <GlobalIngredientArchivedList archive={archive} />
      )}
    </BaseModal>
  );
}
