'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import IngredientTranslationsGrid from '@/components/admin/ingredient-translations/IngredientTranslationsGrid';
import { useIngredientTranslations } from '@/hooks/admin/useIngredientTranslations';
import { fold } from '@/utils/nameFold';
import styles from './styles.module.css';

type KindFilter = 'all' | 'sauce' | 'ingredient';

/**
 * The Ingredients & Sauces translations manager (partner feedback, mcdoner).
 *
 * Ingredients exist as per-product copies, so the editor's own Translations workbench — one
 * product at a time — is exactly the surface where "fixed it" fixes ONE product. This page is the
 * reverse: every distinct ingredient and sauce the tenant uses, one row, one name per language,
 * and a save that applies the name to EVERY product and bundle option that references it.
 *
 * Admin-only: the bulk-apply endpoint it calls writes across the whole catalog.
 */
function IngredientTranslationsPage() {
  const { t } = useTranslation();
  const { entries, loading, loadError, load, edits, edit, save, savingKey, receipt, saveError, isDirty } =
    useIngredientTranslations();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = fold(query);
    return entries.filter((entry) => {
      if (kind !== 'all' && (entry.isSauce ? kind !== 'sauce' : kind !== 'ingredient')) return false;
      return needle.length === 0 || fold(entry.defaultName).includes(needle);
    });
  }, [entries, query, kind]);

  const kindChips: ReadonlyArray<{ id: KindFilter; label: string }> = [
    { id: 'all', label: t('all_dish_types_filter') },
    { id: 'sauce', label: t('sauces') },
    { id: 'ingredient', label: t('ingredients') },
  ];

  return (
    <AdminAuthGuard requiredRoles={['Admin']}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>{t('admin_ingredient_translations_title')}</h1>
          <p className={styles.subtitle}>{t('ingredient_translations_intro')}</p>
        </header>

        {receipt && (
          <div className={styles.successBanner} role="status">
            <p>{t('ingredient_translations_receipt_products', { count: receipt.updatedProductCount })}</p>
            <p className={styles.receiptNames} dir="auto">
              {receipt.items.map((item) => item.productName).join(', ')}
            </p>
          </div>
        )}
        {saveError && (
          <div className={styles.errorBanner} role="alert">
            {t('ingredient_translations_save_failed')}
          </div>
        )}

        <div className={styles.toolbar}>
          <input
            type="search"
            className={styles.searchInput}
            value={query}
            placeholder={t('ingredient_translations_search')}
            aria-label={t('ingredient_translations_search')}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className={styles.chipRow} role="group" aria-label={t('all_dish_types_filter')}>
            {kindChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={`${styles.chip} ${kind === chip.id ? styles.chipActive : ''}`}
                onClick={() => setKind(chip.id)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className={styles.loading}>{t('loading')}</p>
        ) : loadError ? (
          <div className={styles.errorBanner} role="alert">
            <p>{t('ingredient_translations_load_failed')}</p>
            <button type="button" onClick={() => load()}>
              {t('retry')}
            </button>
          </div>
        ) : visible.length === 0 ? (
          <p className={styles.loading}>{t('ingredient_translations_empty')}</p>
        ) : (
          <IngredientTranslationsGrid
            entries={visible}
            edits={edits}
            dirtyKeys={isDirty}
            savingKey={savingKey}
            onEdit={edit}
            onSave={save}
          />
        )}
      </div>
    </AdminAuthGuard>
  );
}

export default IngredientTranslationsPage;
