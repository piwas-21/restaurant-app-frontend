'use client';

import { useTranslation } from 'react-i18next';
import { formatPlainCurrency } from '@/utils/currency';
import type { Product } from '@/services/serverService';
import type { ServerTakeawayCategory } from '@/hooks/serverTakeaway/useServerTakeawayCatalog';
import styles from './ServerTakeawayCatalog.module.css';

interface ServerTakeawayCatalogProps {
  readonly categories: readonly ServerTakeawayCategory[];
  readonly products: readonly Product[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly selectedCategoryId: string | null;
  readonly onSelectCategory: (categoryId: string | null) => void;
  readonly searchQuery: string;
  readonly onSearchChange: (value: string) => void;
  readonly onRetry: () => void;
  readonly tapPendingId: string | null;
  readonly onTapProduct: (product: Product) => void;
}

export default function ServerTakeawayCatalog({
  categories,
  products,
  isLoading,
  error,
  selectedCategoryId,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onRetry,
  tapPendingId,
  onTapProduct,
}: ServerTakeawayCatalogProps) {
  const { t } = useTranslation();

  return (
    <section className={styles.catalog} aria-label={t('server.takeaway.catalog_label')}>
      <p className={styles.productOnlyNote}>{t('server.takeaway.product_only_note')}</p>
      <label className={styles.searchLabel} htmlFor="server-takeaway-search">
        {t('server.takeaway.search')}
      </label>
      <input
        id="server-takeaway-search"
        type="search"
        className={styles.search}
        value={searchQuery}
        placeholder={t('server.takeaway.search')}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <div className={styles.categories} role="tablist" aria-label={t('server.takeaway.categories')}>
        <button
          type="button"
          role="tab"
          aria-selected={selectedCategoryId === null}
          className={`${styles.categoryChip} ${selectedCategoryId === null ? styles.active : ''}`}
          onClick={() => onSelectCategory(null)}
        >
          {t('server.takeaway.all_items')}
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={selectedCategoryId === category.id}
            className={`${styles.categoryChip} ${selectedCategoryId === category.id ? styles.active : ''}`}
            onClick={() => onSelectCategory(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>

      {isLoading && <p className={styles.status}>{t('server.takeaway.loading_catalog')}</p>}
      {!isLoading && error && (
        <div className={styles.statusError} role="alert">
          <p>{t('server.takeaway.catalog_error')}</p>
          <button type="button" className={styles.retry} onClick={onRetry}>
            {t('server.takeaway.retry')}
          </button>
        </div>
      )}
      {!isLoading && !error && products.length === 0 && (
        <p className={styles.status}>{t('server.takeaway.no_products')}</p>
      )}

      <div className={styles.grid}>
        {products.map((product) => (
          <button
            key={product.id}
            type="button"
            className={styles.tile}
            disabled={tapPendingId === product.id}
            aria-label={t('server.takeaway.add_product', { name: product.name })}
            onClick={() => onTapProduct(product)}
          >
            <span className={styles.tileName} dir="auto">
              {product.name}
            </span>
            <span className={styles.tilePrice}>{formatPlainCurrency(product.basePrice)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
