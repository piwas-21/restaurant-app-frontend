'use client';

import { useTranslation } from 'react-i18next';
import { formatPlainCurrency } from '@/utils/currency';
import type { Product } from '@/services/serverService';
import type { ServerTableRoundCategory } from '@/hooks/serverTableRound/useServerTableRoundCatalog';
import { isMenuBundle } from '@/utils/productTypeFilter';
import styles from './ServerTableRoundCatalog.module.css';

interface Props {
  readonly categories: readonly ServerTableRoundCategory[];
  readonly products: readonly Product[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly selectedCategoryId: string | null;
  readonly onSelectCategory: (id: string | null) => void;
  readonly searchQuery: string;
  readonly onSearchChange: (value: string) => void;
  readonly onRetry: () => void;
  readonly onTapProduct: (product: Product) => void;
  readonly tapPendingId: string | null;
  readonly favoriteIds: readonly string[];
  readonly showFavorites: boolean;
  readonly onShowFavorites: (show: boolean) => void;
  readonly onToggleFavorite: (productId: string) => void;
}

export default function ServerTableRoundCatalog({
  categories,
  products,
  isLoading,
  error,
  selectedCategoryId,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onRetry,
  onTapProduct,
  tapPendingId,
  favoriteIds,
  showFavorites,
  onShowFavorites,
  onToggleFavorite,
}: Props) {
  const { t } = useTranslation();
  return (
    <section className={styles.catalog} aria-label={t('server.round.catalog_label')}>
      <p className={styles.identity}>{t('server.round.catalog_description')}</p>
      <label className={styles.searchLabel} htmlFor="server-round-search">
        {t('server.round.search')}
      </label>
      <input
        id="server-round-search"
        className={styles.search}
        type="search"
        value={searchQuery}
        placeholder={t('server.round.search')}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <div className={styles.categories} role="tablist" aria-label={t('server.round.categories')}>
        <button
          type="button"
          role="tab"
          aria-selected={showFavorites}
          className={`${styles.categoryChip} ${showFavorites ? styles.active : ''}`}
          onClick={() => onShowFavorites(true)}
        >
          {t('server.round.favorites')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!showFavorites && selectedCategoryId === null}
          className={`${styles.categoryChip} ${!showFavorites && selectedCategoryId === null ? styles.active : ''}`}
          onClick={() => {
            onShowFavorites(false);
            onSelectCategory(null);
          }}
        >
          {t('server.round.all_items')}
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={!showFavorites && selectedCategoryId === category.id}
            className={`${styles.categoryChip} ${!showFavorites && selectedCategoryId === category.id ? styles.active : ''}`}
            onClick={() => {
              onShowFavorites(false);
              onSelectCategory(category.id);
            }}
          >
            {category.name}
          </button>
        ))}
      </div>
      {isLoading && <p className={styles.status}>{t('server.round.loading_catalog')}</p>}
      {!isLoading && error && (
        <div className={styles.error} role="alert">
          <p>{t(error, error)}</p>
          <button type="button" className={styles.retry} onClick={onRetry}>
            {t('server.round.retry')}
          </button>
        </div>
      )}
      {!isLoading && !error && products.length === 0 && <p className={styles.status}>{t('server.round.no_items')}</p>}
      <div className={styles.grid}>
        {products.map((product) => {
          const favorite = favoriteIds.includes(product.id);
          const unavailable = product.availability?.canOrder === false;
          return (
            <article key={product.id} className={`${styles.tile} ${unavailable ? styles.unavailable : ''}`}>
              <button
                type="button"
                className={styles.favorite}
                onClick={() => onToggleFavorite(product.id)}
                aria-pressed={favorite}
                aria-label={t(favorite ? 'server.round.remove_favorite' : 'server.round.add_favorite', {
                  name: product.name,
                })}
              >
                <span aria-hidden="true">{favorite ? '★' : '☆'}</span>
              </button>
              <button
                type="button"
                className={styles.addItem}
                onClick={() => onTapProduct(product)}
                disabled={unavailable || tapPendingId === product.id}
                aria-label={t(unavailable ? 'server.round.unavailable_item' : 'server.round.add_item', {
                  name: product.name,
                })}
              >
                <span className={styles.name} dir="auto">
                  {product.name}
                </span>
                <span className={styles.kind}>
                  {unavailable
                    ? t('server.round.unavailable_for_dine_in')
                    : isMenuBundle(product)
                      ? t('server.round.bundle')
                      : t('server.round.item')}
                </span>
                <span className={styles.price}>{formatPlainCurrency(product.basePrice)}</span>
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
