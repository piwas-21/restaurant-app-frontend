'use client';

import { useTranslation } from 'react-i18next';
import { formatPlainCurrency } from '@/utils/currency';
import type { Product } from '@/services/serverService';
import type { CashierCatalogCategory } from '@/hooks/cashier/useCashierCatalog';
import styles from './CashierNewSaleCatalog.module.css';

interface CashierNewSaleCatalogProps {
  readonly categories: readonly CashierCatalogCategory[];
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

/**
 * The catalog half of the counter sale (plan §5.3): category strip, search, and text-first
 * tiles with large names and prices. Tiles are buttons — a tap either adds the product or
 * opens the shared customization sheet, and the data behind both is the guest menu's own.
 */
export default function CashierNewSaleCatalog({
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
}: CashierNewSaleCatalogProps) {
  const { t } = useTranslation();

  return (
    <section className={styles.catalog} aria-label={t('cashier.new_sale.catalog_label')}>
      <div className={styles.searchRow}>
        <input
          type="search"
          className={styles.search}
          value={searchQuery}
          placeholder={t('cashier.new_sale.search_placeholder')}
          aria-label={t('cashier.new_sale.search_placeholder')}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <div className={styles.categories} role="tablist" aria-label={t('cashier.new_sale.categories_label')}>
        <button
          type="button"
          role="tab"
          aria-selected={selectedCategoryId === null}
          className={`${styles.categoryChip} ${selectedCategoryId === null ? styles.categoryChipActive : ''}`}
          onClick={() => onSelectCategory(null)}
        >
          {t('cashier.new_sale.all_categories')}
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={selectedCategoryId === category.id}
            className={`${styles.categoryChip} ${selectedCategoryId === category.id ? styles.categoryChipActive : ''}`}
            onClick={() => onSelectCategory(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>

      {isLoading && <p className={styles.status}>{t('cashier.new_sale.catalog_loading')}</p>}

      {!isLoading && error && (
        <div className={styles.statusError} role="alert">
          <p>{t('cashier.new_sale.catalog_unavailable')}</p>
          <button type="button" className={styles.retryButton} onClick={onRetry}>
            {t('cashier.workspace.retry')}
          </button>
        </div>
      )}

      {!isLoading && !error && products.length === 0 && (
        <p className={styles.status}>{t('cashier.new_sale.no_products')}</p>
      )}

      <div className={styles.grid}>
        {products.map((product) => (
          <button
            key={product.id}
            type="button"
            className={styles.tile}
            disabled={tapPendingId === product.id}
            aria-label={t('cashier.new_sale.add_product', { name: product.name })}
            onClick={() => onTapProduct(product)}
          >
            <span className={styles.tileName}>{product.name}</span>
            <span className={styles.tilePrice}>{formatPlainCurrency(product.basePrice)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
