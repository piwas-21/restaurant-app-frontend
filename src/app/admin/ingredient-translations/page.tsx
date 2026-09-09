'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import Pagination from '@/components/common/Pagination';
import IngredientTranslationsGrid from '@/components/admin/ingredient-translations/IngredientTranslationsGrid';
import { useIngredientTranslations } from '@/hooks/admin/useIngredientTranslations';
import {
  INGREDIENT_TRANSLATIONS_PAGE_SIZES,
  useIngredientTranslationsView,
  type KindFilter,
  type OriginFilter,
} from '@/hooks/admin/useIngredientTranslationsView';
import styles from './styles.module.css';

/**
 * The Ingredients & Sauces translations manager (partner feedback, mcdoner).
 *
 * Ingredients exist as per-product copies, so the editor's own Translations workbench — one
 * product at a time — is exactly the surface where "fixed it" fixes ONE product. This page is the
 * reverse: every distinct ingredient and sauce the tenant uses, one row, one name per language,
 * and a save that applies the name to EVERY product and bundle option that references it.
 *
 * Partner feedback (trans-ux): the catalog is filtered by origin (library-linked vs the tenant's
 * own), paged client-side with a page-size selector, and saved in BATCH from a sticky bar — the
 * old per-row save button hid past the tenth locale column.
 *
 * Admin-only: the bulk-apply endpoint it calls writes across the whole catalog.
 */
function IngredientTranslationsPage() {
  const { t } = useTranslation();
  const { entries, loading, loadError, load, edits, edit, saveAll, saving, receipt, saveError, isDirty } =
    useIngredientTranslations();
  const view = useIngredientTranslationsView(entries);

  useEffect(() => {
    load();
  }, [load]);

  const kindChips: ReadonlyArray<{ id: KindFilter; label: string }> = [
    { id: 'all', label: t('all_dish_types_filter') },
    { id: 'sauce', label: t('sauces') },
    { id: 'ingredient', label: t('ingredients') },
  ];

  const originChips: ReadonlyArray<{ id: OriginFilter; label: string }> = [
    { id: 'all', label: t('ingredient_translations_origin_all') },
    { id: 'library', label: t('ingredient_translations_origin_library') },
    { id: 'custom', label: t('ingredient_translations_origin_custom') },
  ];

  const pageStart = (view.page - 1) * view.pageSize + 1;
  const pageEnd = Math.min(view.page * view.pageSize, view.filteredCount);

  const renderBody = () => {
    if (loading) return <p className={styles.loading}>{t('loading')}</p>;
    if (loadError)
      return (
        <div className={styles.errorBanner} role="alert">
          <p>{t('ingredient_translations_load_failed')}</p>
          <button type="button" onClick={() => load()}>
            {t('retry')}
          </button>
        </div>
      );
    if (view.filteredCount === 0) return <p className={styles.loading}>{t('ingredient_translations_empty')}</p>;
    return (
      <>
        <IngredientTranslationsGrid entries={view.paged} edits={edits} dirtyKeys={isDirty} onEdit={edit} />
        <div className={styles.paginationRow}>
          <label className={styles.pageSizeLabel}>
            {t('ingredient_translations_per_page')}
            <select
              className={styles.pageSizeSelect}
              value={view.pageSize}
              onChange={(event) => view.setPageSize(Number(event.target.value))}
            >
              {INGREDIENT_TRANSLATIONS_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <Pagination currentPage={view.page} totalPages={view.totalPages} onPageChange={view.setPage} />
          {view.filteredCount > 0 && (
            <p className={styles.showing}>
              {t('showing_items', { start: pageStart, end: pageEnd, total: view.filteredCount })}
            </p>
          )}
        </div>
      </>
    );
  };

  return (
    <AdminAuthGuard requiredRoles={['Admin']}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>{t('admin_ingredient_translations_title')}</h1>
          <p className={styles.subtitle}>{t('ingredient_translations_intro')}</p>
        </header>

        {receipt && (
          <output className={styles.successBanner}>
            <p>{t('ingredient_translations_receipt_products', { count: receipt.updatedProductCount })}</p>
            <p className={styles.receiptNames} dir="auto">
              {receipt.items.map((item) => item.productName).join(', ')}
            </p>
          </output>
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
            value={view.query}
            placeholder={t('ingredient_translations_search')}
            aria-label={t('ingredient_translations_search')}
            onChange={(event) => view.setQuery(event.target.value)}
          />
          <fieldset className={styles.chipRow} aria-label={t('all_dish_types_filter')}>
            {kindChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={`${styles.chip} ${view.kind === chip.id ? styles.chipActive : ''}`}
                onClick={() => view.setKind(chip.id)}
              >
                {chip.label}
              </button>
            ))}
          </fieldset>
          <fieldset className={styles.chipRow} aria-label={t('ingredient_translations_filter_origin')}>
            {originChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={`${styles.chip} ${view.origin === chip.id ? styles.chipActive : ''}`}
                onClick={() => view.setOrigin(chip.id)}
              >
                {chip.label}
              </button>
            ))}
          </fieldset>
        </div>

        {renderBody()}

        {isDirty.size > 0 && (
          <div className={styles.saveBar} role="status">
            <span className={styles.saveBarCount}>{t('ingredient_translations_unsaved', { count: isDirty.size })}</span>
            <button type="button" className={styles.saveBarButton} disabled={saving} onClick={() => saveAll()}>
              {saving ? t('ingredient_translations_saving') : t('ingredient_translations_save_all')}
            </button>
          </div>
        )}
      </div>
    </AdminAuthGuard>
  );
}

export default IngredientTranslationsPage;
