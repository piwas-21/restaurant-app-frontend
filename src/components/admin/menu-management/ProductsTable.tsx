'use client';

import { formatPlainCurrency } from '@/utils/currency';
import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import styles from '@/app/styles/AdminPage.module.css';
import { Product } from '@/app/admin/menu-management/interfaces';
import { MenuTypeFilter, isMenuBundle } from '@/utils/productTypeFilter';

interface ProductsTableProps {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  /** Receives the ROW, not an id — the row carries the kind (`type`). */
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  /** Only picks the loading/empty wording. Row behaviour derives from the row itself. */
  typeFilter?: MenuTypeFilter;
}

const ProductsTable: React.FC<ProductsTableProps> = ({
  products,
  isLoading,
  error,
  onEdit,
  onDelete,
  typeFilter = 'all',
}) => {
  const { t } = useTranslation();

  const loadingMessage = typeFilter === 'bundles' ? t('loading_menu_bundles') : t('loading_products');
  const emptyMessage = typeFilter === 'bundles' ? t('no_menu_bundles_found') : t('no_products_found');

  if (isLoading) return <p>{loadingMessage}</p>;
  if (error) return <p className={styles.error}>{error}</p>;

  return (
    <div className={styles.adminTableContainer}>
      <table className={styles.adminTable}>
        <thead>
          <tr>
            <th>{t('product_name')}</th>
            <th>{t('base_price')}</th>
            <th>{t('active')}</th>
            <th>{t('available')}</th>
            <th>{t('actions_header')}</th>
          </tr>
        </thead>
        <tbody>
          {products.length > 0 ? (
            products.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{formatPlainCurrency(product.basePrice)}</td>
                <td>{product.isActive ? t('yes') : t('no')}</td>
                <td>{product.isAvailable ? t('yes') : t('no')}</td>
                <td className={styles.actionsCell}>
                  <button onClick={() => onEdit(product)} className={`${styles.adminButton} ${styles.edit}`}>
                    {t('edit')}
                  </button>
                  <button onClick={() => onDelete(product)} className={`${styles.adminButton} ${styles.delete}`}>
                    {t('delete')}
                  </button>
                  <Link
                    // Per ROW, not per view: an "All" list mixes both kinds, so the
                    // active filter cannot say what an individual row is. (Slice 7 PR2c
                    // drops this param entirely — the detail page derives type itself.)
                    href={`/admin/menu-management/${product.id}?type=${isMenuBundle(product) ? 'menu' : 'product'}`}
                    className={`${styles.adminButton} ${styles.view}`}
                  >
                    {t('details')}
                  </Link>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5}>{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ProductsTable;
