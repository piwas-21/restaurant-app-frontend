'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search } from 'lucide-react';
import BaseModal from '@/components/design-system/BaseModal';
import GlobalIngredientPickerRow from './GlobalIngredientPickerRow';
import { useGlobalIngredientLibrary, type LibraryFilter } from '@/hooks/admin/useGlobalIngredientLibrary';
import { createGlobalIngredient, type GlobalIngredientSummary } from '@/services/globalIngredientService';
import { getErrorMessage } from '@/utils/apiClient';
import { serverMessage } from '@/utils/apiFormErrors';
import { toProductIngredient } from './globalIngredientLibrary';
import type { ProductIngredient } from '@/types/menu';
import styles from './GlobalIngredientPickerModal.module.css';

const FILTERS: LibraryFilter[] = ['all', 'notAdded', 'translated'];
const FILTER_LABELS: Record<LibraryFilter, string> = {
  all: 'ingredient_library_filter_all',
  notAdded: 'ingredient_library_filter_not_added',
  translated: 'ingredient_library_filter_translated',
};

interface GlobalIngredientPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The product's current ingredients — what "already added" is measured against. */
  attached: ProductIngredient[];
  /** Receives the picked rows, already mapped to product ingredients. */
  onAdd: (ingredients: ProductIngredient[]) => void;
}

/**
 * Browse the global ingredient library and attach rows to the product (plan S2).
 *
 * The library has been seeded with 654 entries in 9 languages since the GlobalIngredients
 * migration and no screen ever listed it: the only way in was a per-row type-ahead that needs you
 * to guess the English name first. Picking a row here copies its name and its translations onto the
 * product — the 10 free-text translation inputs this saves per ingredient are the whole point — and
 * records `globalIngredientId` as provenance.
 *
 * Copy semantics (plan D3): what is attached is the product's own from that moment. A later edit of
 * the library row does NOT propagate; that needs the frozen order history and is a later slice.
 */
export default function GlobalIngredientPickerModal({
  isOpen,
  onClose,
  attached,
  onAdd,
}: GlobalIngredientPickerModalProps) {
  const { t, i18n } = useTranslation();
  const library = useGlobalIngredientLibrary({ isOpen, attached, languageCode: i18n.language });
  const [selected, setSelected] = useState<GlobalIngredientSummary[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const close = () => {
    setSelected([]);
    setCreateError(null);
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

  const footer = (
    <div className={styles.footer}>
      <button type="button" className={styles.createButton} onClick={() => void createAndAdd()} disabled={isCreating}>
        <Plus size={16} aria-hidden="true" />
        {newName.length > 0 ? t('ingredient_library_create_named', { name: newName }) : t('ingredient_library_create')}
      </button>
      <div className={styles.footerActions}>
        <button type="button" className={styles.cancelButton} onClick={close}>
          {t('cancel')}
        </button>
        <button
          type="button"
          className={styles.confirmButton}
          onClick={() => add(selected)}
          disabled={selected.length === 0}
        >
          {t('add_selected')}
          {selected.length > 0 && <span className={styles.count}> ({selected.length})</span>}
        </button>
      </div>
    </div>
  );

  return (
    <BaseModal isOpen={isOpen} onClose={close} title={t('add_from_library')} size="lg" footer={footer}>
      <div className={styles.searchRow}>
        <Search size={16} className={styles.searchIcon} aria-hidden="true" />
        <input
          type="search"
          className={styles.searchInput}
          value={library.query}
          onChange={(event) => library.setQuery(event.target.value)}
          placeholder={t('ingredient_library_search_placeholder')}
          aria-label={t('ingredient_library_search_label')}
        />
      </div>

      <div className={styles.filters} role="group" aria-label={t('ingredient_library_filter_label')}>
        {FILTERS.map((entry) => (
          <button
            key={entry}
            type="button"
            className={`${styles.chip} ${library.filter === entry ? styles.chipActive : ''}`}
            aria-pressed={library.filter === entry}
            onClick={() => library.setFilter(entry)}
          >
            {t(FILTER_LABELS[entry])}
          </button>
        ))}
      </div>

      {createError && (
        <p className={styles.error} role="alert">
          {createError}
        </p>
      )}

      {library.status === 'loading' && <output className={styles.notice}>{t('searching')}</output>}

      {library.status === 'error' && (
        <div className={styles.error} role="alert">
          {library.loadError}
          <button type="button" className={styles.retryButton} onClick={library.reload}>
            {t('ingredient_library_retry')}
          </button>
        </div>
      )}

      {library.status === 'ready' && library.matchCount === 0 && (
        <p className={styles.notice}>{t('ingredient_library_empty')}</p>
      )}

      {library.status === 'ready' && library.visible.length > 0 && (
        <ul className={styles.list}>
          {library.visible.map((ingredient) => (
            <GlobalIngredientPickerRow
              key={ingredient.id}
              ingredient={ingredient}
              checked={selected.some((entry) => entry.id === ingredient.id)}
              alreadyAdded={library.isAttached(ingredient)}
              onToggle={(checked) => toggle(ingredient, checked)}
            />
          ))}
        </ul>
      )}

      {library.status === 'ready' && library.matchCount > library.visible.length && (
        <p className={styles.notice}>
          {t('ingredient_library_showing', { shown: library.visible.length, total: library.matchCount })}
        </p>
      )}
    </BaseModal>
  );
}
